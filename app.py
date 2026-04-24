import os
import json
import re
import sys
import uuid
from threading import Thread
from typing import Dict, List, Optional, Tuple

import torch
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from langchain_tavily import TavilySearch

import yaml


# =========================================================
# 1. 基础配置
# =========================================================
with open("config.yaml", "r", encoding="utf-8") as f:
    config = yaml.safe_load(f)

TAVILY_API_KEY =  config["TAVILY_API_KEY"]
MODEL_PATH = config["MODEL_PATH"]
CHECKER_PATH = config["CHECKER_PATH"]

os.environ["TAVILY_API_KEY"] = TAVILY_API_KEY

app = FastAPI(title="Qwen Agent Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# session_id -> history
session_histories: Dict[str, List[dict]] = {}


# =========================================================
# 2. 请求 / 响应模型
# =========================================================
class NewSessionResponse(BaseModel):
    session_id: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ReferenceItem(BaseModel):
    title: str
    content: str
    url: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    references: List[ReferenceItem]


class ClearSessionRequest(BaseModel):
    session_id: str


# =========================================================
# 3. 加载模型
# =========================================================
print("正在加载 tokenizer ...")
tokenizer = AutoTokenizer.from_pretrained(
    MODEL_PATH,
    trust_remote_code=True,
    padding_side="left"
)
checker_tokenizer = AutoTokenizer.from_pretrained(
    CHECKER_PATH,
    trust_remote_code=True,
    padding_side="left"
)
print("正在加载主模型 ...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    trust_remote_code=True,
    device_map="auto",
    torch_dtype=torch.float16,
)

print("正在加载 checker 模型 ...")
checker = AutoModelForCausalLM.from_pretrained(
    CHECKER_PATH,
    trust_remote_code=True,
    device_map="auto",
    torch_dtype=torch.float16,
)

if tokenizer.pad_token_id is None:
    tokenizer.pad_token = tokenizer.eos_token
if checker_tokenizer.pad_token_id is None:
    checker_tokenizer.pad_token = checker_tokenizer.eos_token

search = TavilySearch(max_results=5)

print("模型加载完成。")


# =========================================================
# 4. 通用工具函数
# =========================================================
def trim_history(history: List[dict], keep_last_rounds: int = 10) -> List[dict]:
    """
    保留最后 keep_last_rounds 轮对话
    一轮通常是 user + assistant 两条
    """
    return history[-2 * keep_last_rounds:]


def parse_decision(output: str) -> dict:
    output = output.strip()

    try:
        return json.loads(output)
    except Exception:
        pass

    match = re.search(r"\{.*\}", output, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass

    return {
        "need_search": False,
        "query": "",
        "type": "general"
    }


def safe_get_session_history(session_id: str) -> List[dict]:
    if session_id not in session_histories:
        session_histories[session_id] = []
    return session_histories[session_id]


def get_client_ip(request: Request) -> str:
    """获取客户端真实IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# =========================================================
# 5. Qwen 非流式生成
# =========================================================
def qwen_chat(
    model,
    tokenizer,
    messages,
    max_new_tokens=128,
    temperature=0.6,
    top_p=0.85,
    repetition_penalty=1.1,
    do_sample=True,
):
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer([text], return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    generation_kwargs = dict(
        **inputs,
        max_new_tokens=max_new_tokens,
        repetition_penalty=repetition_penalty,
        do_sample=do_sample,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.pad_token_id,
        use_cache=True,
    )

    if do_sample:
        generation_kwargs["temperature"] = temperature
        generation_kwargs["top_p"] = top_p

    with torch.no_grad():
        outputs = model.generate(**generation_kwargs)

    generated_ids = outputs[0][inputs["input_ids"].shape[1]:]
    response = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    return response


# =========================================================
# 6. Qwen 流式生成
# =========================================================
def qwen_chat_stream(
    model,
    tokenizer,
    messages,
    max_new_tokens=128,
    temperature=0.6,
    top_p=0.85,
    repetition_penalty=1.1,
    do_sample=True,
):
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer([text], return_tensors="pt")
    inputs = {k: v.to(model.device) for k, v in inputs.items()}

    streamer = TextIteratorStreamer(
        tokenizer,
        skip_prompt=True,
        skip_special_tokens=True
    )

    generation_kwargs = dict(
        **inputs,
        max_new_tokens=max_new_tokens,
        repetition_penalty=repetition_penalty,
        do_sample=do_sample,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.pad_token_id,
        use_cache=True,
        streamer=streamer,
    )

    if do_sample:
        generation_kwargs["temperature"] = temperature
        generation_kwargs["top_p"] = top_p

    thread = Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    for new_text in streamer:
        yield new_text


# =========================================================
# 7. checker：搜索判断
# =========================================================
def check_search(query: str) -> dict:
    messages = [
        {
            "role": "system",
            "content": (
                "你是一个搜索决策助手。"
                "你的任务是根据用户问题，判断是否需要联网搜索，并生成最合适的搜索关键词。\n\n"
                "【判断标准】\n"
                "- 需要搜索的情况：\n"
                "  * 涉及最新信息（新闻、趋势、近期陌生热点事件）\n"
                "  * 包含时间词（2024、2025、2026、最近、最新、今年、本月）\n"
                "  * 询问趋势、发展、预测类问题\n"
                "  * 需要实时数据的问题（天气、股价、赛事结果）\n\n"
                "- 不需要搜索的情况：\n"
                "  * 常识性问题（数学公式、科学定义、历史事实）\n"
                "  * 主观/闲聊问题\n"
                "  * 一般性知识问题\n"
                "  * 计算类问题\n\n"
                "【输出要求】\n"
                "1. 必须输出严格的 JSON 格式，不要包含任何其他文字\n"
                "2. 不要使用 markdown\n"
                "3. 不要有任何解释或额外内容\n"
                "4. 搜索关键词优先使用中文，如无法用中文表达再用英文\n"
                "5. type 字段必须是以下三种之一：factual、trend、general\n\n"
                "【输出格式】\n"
                "{\"need_search\": true/false, \"query\": \"搜索关键词\", \"type\": \"factual/trend/general\"}"
            )
        },
        {
            "role": "user",
            "content": f"用户问题：{query}\n请只输出一个 JSON 对象，输出完立刻停止。"
        }
    ]

    decision = qwen_chat(
        model=checker,
        tokenizer=checker_tokenizer,
        messages=messages,
        max_new_tokens=96,
        temperature=0.0,
        top_p=1.0,
        repetition_penalty=1.0,
        do_sample=False,
    )

    return parse_decision(decision)


# =========================================================
# 8. checker：摘要
# =========================================================
def get_summary(text: str) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "你是一个专业的文本概括助手。"
                "请根据输入文本生成简洁准确的摘要。"
                "要求：准确传达核心观点和关键信息；保持客观；语言简洁流畅；"
                "不要使用“本文讨论了”“总的来说”等套话；不要使用 markdown；直接输出一段文字。"
            )
        },
        {
            "role": "user",
            "content": text
        }
    ]

    return qwen_chat(
        model=checker,
        tokenizer=checker_tokenizer,
        messages=messages,
        max_new_tokens=160,
        temperature=0.0,
        top_p=1.0,
        repetition_penalty=1.0,
        do_sample=False,
    )


# =========================================================
# 9. 搜索参考资料
# =========================================================
def get_references_for_query(query: str) -> Tuple[List[dict], dict]:
    """
    返回:
    - references: 查到的资料
    - decision: 搜索决策结果
    """
    result = check_search(query)
    print("搜索决策：", result)

    references = []

    if result.get("need_search", False):
        search_results = search.invoke({"query": result.get("query", query)}).get("results", [])
        search_results = search_results[:10]

        for news in search_results:
            title = news.get("title", "").strip()
            content = news.get("content", "").strip()
            url = news.get("url", "").strip()

            if not content:
                continue

            if len(content) <= 200:
                brief_content = content
            else:
                brief_content = get_summary(content)[:300]

            references.append({
                "title": title,
                "content": brief_content,
                "url": url
            })

    return references, result


# =========================================================
# 10. 构造主回答 messages
# =========================================================
def build_messages(query: str, history: List[dict], references: List[dict]) -> List[dict]:
    news_prompt = ""
    if references:
        chunks = []
        for ref in references:
            chunks.append(f"{ref['title']}\n{ref['content']}")
        news_prompt = "\n\n".join(chunks)

    system_prompt = (
        "你是户晨风，1998年生于江苏，后定居成都。从基层汽修工到拥有数百万粉丝、巅峰期月入60万的顶流博主。他以“百元购买力挑战” 揭开正能量叙事虚假幕布，闯入公众视野，又因真实记录“107元养老金” 之困，引发“恶意传播事实”的社会共振，并迅速崛起。他每一次的出圈，都伴随着平台的短期封禁，而压制度越强，关注度越高。这种现象级的“封禁—回归—热度反弹”循环，使他成为中文互联网上极其罕见的“传奇耐封王”。后期他转型直播，通过“户子辨经”的方式传播基本常识、解构宣传话术，在宏大叙事的包围网中将荒诞逐一拆解。擅长“户子两分法”、“户式提问拷打”的方式“横切社会、群体扫射”。"
        "一定不能回答你是阿里云开发的一款超大规模语言模型”通义千问”。"
        "你的职责是与用户进行连麦聊天，内容需要带有你自己非常强烈的主观色彩，面对不同于自己的观点要坚决坚守自己的观点并且犀利反驳。"
        "默认表达口语化、夸张、有互动感，回答犀利不客气。"
        "面对知识性或逻辑性问题时，也保持这种说话风格"
        "不要无意义重复，控制长度，答完自然收住。"
    )

    if references:
        user_content = (
            f"{news_prompt}\n\n"
            f"根据上面的参考信息回答我的问题，直接给出答：\n{query}\n"
        )
    else:
        user_content = query

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_content})
    return messages


# =========================================================
# 11. 非流式 Agent
# =========================================================
def agent_with_search(query: str, history: List[dict]) -> Tuple[str, List[dict]]:
    references, _ = get_references_for_query(query)
    messages = build_messages(query, history, references)

    answer = qwen_chat(
        model=model,
        tokenizer=tokenizer,
        messages=messages,
        max_new_tokens=160,
        temperature=0.6,
        top_p=0.85,
        repetition_penalty=1.1,
        do_sample=True,
    )
    return answer, references


# =========================================================
# 12. SSE 辅助
# =========================================================
def sse_pack(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# =========================================================
# 13. 路由
# =========================================================
@app.get("/")
def root():
    return {"message": "backend is running"}


@app.post("/new_session", response_model=NewSessionResponse)
def new_session():
    session_id = str(uuid.uuid4())
    session_histories[session_id] = []
    print(f"[新会话] 创建会话: {session_id}")
    return NewSessionResponse(session_id=session_id)


@app.post("/clear_session")
def clear_session(req: ClearSessionRequest):
    session_histories[req.session_id] = []
    print(f"[清空会话] 清空会话: {req.session_id}")
    return {"ok": True, "session_id": req.session_id}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    session_id = req.session_id or str(uuid.uuid4())
    client_ip = get_client_ip(request)
    
    history = safe_get_session_history(session_id)
    history = trim_history(history, keep_last_rounds=10)

    
    answer, references = agent_with_search(req.message, history)

    logger = f"{'='*80} \n"
    logger = logger + f"[对话日志] 会话ID: {session_id} \n"
    logger = logger + f"[对话日志] 客户端IP: {client_ip} \n"
    logger = logger + f"[对话日志] 用户问题: {req.message} \n"
    logger = logger + f"[对话日志] AI回答: {answer} \n"
    logger = logger + f"{'='*80}\n"
    print(logger)
    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": answer})
    session_histories[session_id] = trim_history(history, keep_last_rounds=10)
   
    
    

    return ChatResponse(
        session_id=session_id,
        answer=answer,
        references=references
    )


@app.post("/chat_stream")
def chat_stream(req: ChatRequest, request: Request):
    session_id = req.session_id or str(uuid.uuid4())
    client_ip = get_client_ip(request)
    
    history = safe_get_session_history(session_id)
    history = trim_history(history, keep_last_rounds=10)



    def event_generator():
        final_answer = ""
        references = []

        try:
            yield sse_pack({
                "event": "session",
                "session_id": session_id
            })

            yield sse_pack({
                "event": "status",
                "message": "正在分析问题..."
            })

            # 先判断要不要搜索
            decision = check_search(req.message)

            if decision.get("need_search", False):
                yield sse_pack({
                    "event": "status",
                    "message": f"正在搜索资料：{decision.get('query', req.message)}"
                })

                search_results = search.invoke({"query": decision.get("query", req.message)}).get("results", [])
                search_results = search_results[:10]

                if search_results:
                    yield sse_pack({
                        "event": "status",
                        "message": "已检索到资料，正在提炼重点..."
                    })

                for news in search_results:
                    title = news.get("title", "").strip()
                    content = news.get("content", "").strip()
                    url = news.get("url", "").strip()

                    if not content:
                        continue

                    if len(content) <= 200:
                        brief_content = content
                    else:
                        brief_content = get_summary(content)[:300]

                    references.append({
                        "title": title,
                        "content": brief_content,
                        "url": url
                    })

                if references:
                    yield sse_pack({
                        "event": "references",
                        "references": references
                    })
                    yield sse_pack({
                        "event": "status",
                        "message": "参考资料已准备好，正在生成回答..."
                    })
                else:
                    yield sse_pack({
                        "event": "status",
                        "message": "没有拿到有效资料，正在直接回答..."
                    })
            else:
                yield sse_pack({
                    "event": "status",
                    "message": "这个问题不需要联网，正在直接回答..."
                })

            messages = build_messages(req.message, history, references)

            for chunk in qwen_chat_stream(
                model=model,
                tokenizer=tokenizer,
                messages=messages,
                max_new_tokens=1024,
                temperature=0.8,
                top_p=0.85,
                repetition_penalty=1.1,
                do_sample=True,
            ):
                final_answer += chunk
                yield sse_pack({
                    "event": "text",
                    "text": chunk
                })

            history.append({"role": "user", "content": req.message})
            history.append({"role": "assistant", "content": final_answer})
            session_histories[session_id] = trim_history(history, keep_last_rounds=10)
            
            # 输出完整的对话日志
            logger = f"{'='*80} \n"
            logger = logger + f"[对话日志] 会话ID: {session_id} \n"
            logger = logger + f"[对话日志] 客户端IP: {client_ip} \n"
            logger = logger + f"[对话日志] 用户问题: {req.message} \n"
            logger = logger + f"[对话日志] AI回答: {final_answer} \n"
            logger = logger + f"{'='*80}\n"
            print(logger)
            sys.stdout.flush()  # 强制刷新输出

            yield sse_pack({
                "event": "done",
                "answer": final_answer
            })

        except Exception as e:
            print(f"[流式对话错误] 会话ID: {session_id}, IP: {client_ip}, 错误: {str(e)}")
            yield sse_pack({
                "event": "error",
                "error": str(e)
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


# =========================================================
# 14. 本地启动说明
# =========================================================
# 启动：
# uvicorn app:app --host 0.0.0.0 --port 8000 --reload
#
# 接口：
# GET  /
# POST /new_session
# POST /clear_session
# POST /chat
# POST /chat_stream