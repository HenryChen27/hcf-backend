// App.jsx - 主应用组件
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Sparkles, 
  ChevronDown, 
  Loader2,
  Bot,
  User,
  Globe,
  Zap,
  Square
} from 'lucide-react';

// API 配置
const API_BASE = 'http://172.26.94.5:8000';

// 会话数据结构
const createEmptySession = (id = null, title = '直播切片') => ({
  id: id || generateUUID(),
  title: title,
  createdAt: new Date().toISOString(),
  messages: [],
  isNew: id ? false : true  // 有真实ID就不是新会话
});

// UUID 生成器（仅用于临时ID）
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 状态消息组件
const StatusCard = ({ message, icon }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full border border-blue-500/20 w-fit"
  >
    {icon === 'loading' ? (
      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
    ) : (
      <Globe className="w-4 h-4 text-purple-400" />
    )}
    <span className="text-sm text-blue-200">{message}</span>
  </motion.div>
);

// 参考资料折叠组件 - 默认折叠
const References = ({ references }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!references || references.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-200 group"
      >
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-blue-400" />
        </motion.div>
        <span className="text-xs text-gray-400">
          {references.length} 条参考资料
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-2"
          >
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {references.map((ref, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-white/5"
                >
                  <a
                    href={ref.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors break-all"
                  >
                    {ref.title || '未知来源'}
                  </a>
                  {ref.content && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {ref.content}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// 消息气泡组件
const MessageBubble = ({ message, isUser, references, isStreaming }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
          : 'bg-gradient-to-br from-gray-700 to-gray-800 border border-blue-500/30'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-blue-400" />
        )}
      </div>

      <div className={`max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
            : 'bg-white/5 backdrop-blur-sm border border-white/10 text-gray-100'
        }`}>
          <div className="whitespace-pre-wrap break-words">
            {message}
            {isStreaming && !isUser && (
              <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-400 animate-pulse" />
            )}
          </div>
        </div>
        {!isUser && references && references.length > 0 && !isStreaming && (
          <References references={references} />
        )}
        {!isUser && references && references.length > 0 && isStreaming && (
          <div className="mt-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-xs text-gray-400">
                正在加载 {references.length} 条参考资料...
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// 会话列表项组件
const SessionItem = ({ session, isActive, onSelect, onDelete, isDeleting }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`group relative rounded-xl p-3 cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30'
          : 'hover:bg-white/5 border border-transparent'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <MessageSquare className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-white">
            {session.title || '直播切片'}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(session.createdAt).toLocaleDateString()}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded-lg disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

// 主应用组件
function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('vibeai_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamingReferences, setStreamingReferences] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [deletingSessions, setDeletingSessions] = useState({});
  
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentSession = sessions[currentSessionId];

  // 初始化：创建第一个会话
  useEffect(() => {
    const initFirstSession = async () => {
      if (Object.keys(sessions).length === 0) {
        await createNewSession();
      } else if (!currentSessionId) {
        // 如果有会话但没有当前会话ID，设置第一个为当前
        const firstSessionId = Object.keys(sessions)[0];
        setCurrentSessionId(firstSessionId);
      }
      setIsInitializing(false);
    };
    
    initFirstSession();
  }, []); // 只在组件挂载时执行一次

  // 保存到 localStorage
  useEffect(() => {
    if (!isInitializing && Object.keys(sessions).length > 0) {
      localStorage.setItem('vibeai_sessions', JSON.stringify(sessions));
    }
  }, [sessions, isInitializing]);
  
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('vibeai_current', currentSessionId);
    }
  }, [currentSessionId]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, streamingMessage, scrollToBottom]);

  // 创建新会话（调用后端API）
  const createNewSession = async () => {
    if (isStreaming) return;
    
    try {
      // 调用后端创建新会话
      const response = await fetch(`${API_BASE}/new_session`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const newSessionId = data.session_id;
      
      // 创建前端会话对象
      const sessionCount = Object.keys(sessions).length;
      const newSession = createEmptySession(
        newSessionId, 
        `直播切片 ${sessionCount + 1}`
      );
      
      setSessions(prev => ({
        ...prev,
        [newSession.id]: newSession
      }));
      setCurrentSessionId(newSession.id);
      
      console.log('新会话创建成功:', newSessionId);
      return newSession;
    } catch (error) {
      console.error('创建会话失败:', error);
      // 降级：创建本地会话
      const sessionCount = Object.keys(sessions).length;
      const newSession = createEmptySession(
        null,
        `直播切片 ${sessionCount + 1}`
      );
      setSessions(prev => ({
        ...prev,
        [newSession.id]: newSession
      }));
      setCurrentSessionId(newSession.id);
      return newSession;
    }
  };

  // 删除会话（调用后端API）
  const deleteSession = async (sessionId) => {
    // 检查是否可以删除
    if (Object.keys(sessions).length === 1) {
      alert('至少保留一个会话');
      return;
    }
    
    if (isStreaming) {
      alert('请等待当前回答完成后再删除会话');
      return;
    }
    
    // 设置删除状态
    setDeletingSessions(prev => ({ ...prev, [sessionId]: true }));
    
    try {
      const session = sessions[sessionId];
      
      // 如果会话有真实的 session_id，调用后端清除历史
      if (session.id && !session.isNew) {
        const response = await fetch(`${API_BASE}/clear_session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: session.id
          })
        });
        
        if (!response.ok) {
          console.warn(`清除会话历史失败: ${response.status}`);
        } else {
          console.log('会话历史已清除:', session.id);
        }
      }
      
      // 删除前端会话
      const newSessions = { ...sessions };
      delete newSessions[sessionId];
      setSessions(newSessions);
      
      // 如果删除的是当前会话，切换到第一个可用的会话
      if (currentSessionId === sessionId) {
        const firstSessionId = Object.keys(newSessions)[0];
        setCurrentSessionId(firstSessionId);
      }
      
      console.log('会话删除成功:', sessionId);
    } catch (error) {
      console.error('删除会话失败:', error);
      alert('删除会话失败，请重试');
    } finally {
      setDeletingSessions(prev => {
        const newState = { ...prev };
        delete newState[sessionId];
        return newState;
      });
    }
  };

  // 清除当前会话历史（可选功能）
  const clearCurrentSession = async () => {
    if (!currentSessionId || isStreaming) return;
    
    try {
      const session = sessions[currentSessionId];
      
      // 调用后端清除会话历史
      const response = await fetch(`${API_BASE}/clear_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.id
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 清除前端会话消息
      setSessions(prev => ({
        ...prev,
        [currentSessionId]: {
          ...prev[currentSessionId],
          messages: []
        }
      }));
      
      console.log('当前会话已清空');
    } catch (error) {
      console.error('清空会话失败:', error);
      alert('清空会话失败，请重试');
    }
  };

  // 停止生成
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingMessage('');
      setStreamingReferences(null);
      setCurrentStatus(null);
      
      // 如果已经有部分回答，保存当前内容
      if (streamingMessage) {
        setSessions(prev => {
          const updatedSession = {
            ...prev[currentSessionId],
            messages: [
              ...prev[currentSessionId].messages,
              {
                role: 'assistant',
                content: streamingMessage + '\n\n[用户中断生成]',
                references: streamingReferences || []
              }
            ]
          };
          return {
            ...prev,
            [currentSessionId]: updatedSession
          };
        });
      }
      
      abortControllerRef.current = null;
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (!inputMessage.trim() || isStreaming || !currentSession) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // 更新会话标题（如果是新对话）
    const session = sessions[currentSessionId];
    if (session.title === '直播切片' || session.title?.startsWith('直播切片')) {
      const newTitle = userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : '');
      setSessions(prev => ({
        ...prev,
        [currentSessionId]: {
          ...prev[currentSessionId],
          title: newTitle
        }
      }));
    }
    
    // 添加用户消息
    setSessions(prev => ({
      ...prev,
      [currentSessionId]: {
        ...prev[currentSessionId],
        messages: [
          ...prev[currentSessionId].messages,
          { role: 'user', content: userMessage }
        ]
      }
    }));
    
    // 准备流式请求
    setIsStreaming(true);
    setStreamingMessage('');
    setStreamingReferences(null);
    setCurrentStatus({ message: '正在分析问题...', icon: 'loading' });
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    let finalReferences = null;
    let finalAnswerText = '';
    
    try {
      const response = await fetch(`${API_BASE}/chat_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          session_id: currentSession.id  // 使用真实的 session_id
        }),
        signal: abortControllerRef.current.signal
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let finalAnswer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.event) {
                case 'session':
                  if (data.session_id !== currentSession.id) {
                    // 更新会话 ID（如果后端返回了新的）
                    setSessions(prev => {
                      const updated = { ...prev };
                      updated[data.session_id] = updated[currentSessionId];
                      delete updated[currentSessionId];
                      return updated;
                    });
                    setCurrentSessionId(data.session_id);
                  }
                  break;
                  
                case 'status':
                  setCurrentStatus({ message: data.message, icon: 'loading' });
                  break;
                  
                case 'references':
                  finalReferences = data.references;
                  setStreamingReferences(data.references);
                  setCurrentStatus({ message: '参考资料已准备好，正在生成回答...', icon: 'loading' });
                  break;
                  
                case 'text':
                  setCurrentStatus(null);
                  accumulatedText += data.text;
                  setStreamingMessage(accumulatedText);
                  scrollToBottom();
                  break;
                  
                case 'done':
                  finalAnswer = data.answer || accumulatedText;
                  finalAnswerText = finalAnswer;
                  setStreamingMessage(finalAnswer);
                  setCurrentStatus(null);
                  break;
                  
                case 'error':
                  setCurrentStatus({ message: `错误: ${data.error}`, icon: 'error' });
                  break;
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }
      
      // 保存助手消息
      if (finalAnswerText || accumulatedText) {
        setSessions(prev => {
          const updatedSession = {
            ...prev[currentSessionId],
            messages: [
              ...prev[currentSessionId].messages,
              {
                role: 'assistant',
                content: finalAnswerText || accumulatedText,
                references: finalReferences || streamingReferences || []
              }
            ]
          };
          return {
            ...prev,
            [currentSessionId]: updatedSession
          };
        });
      }
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('流式请求失败:', error);
        setCurrentStatus({ message: '网络错误，请重试', icon: 'error' });
      } else {
        console.log('用户停止了生成');
      }
    } finally {
      if (abortControllerRef.current?.signal.aborted) {
        // 已经被中止，状态已在 stopGeneration 中处理
      } else {
        setIsStreaming(false);
        setStreamingMessage('');
        setStreamingReferences(null);
        setTimeout(() => setCurrentStatus(null), 1000);
      }
      abortControllerRef.current = null;
    }
  };

  // 处理发送或停止按钮点击
  const handleSendOrStop = () => {
    if (isStreaming) {
      stopGeneration();
    } else {
      sendMessage();
    }
  };

  // 获取当前会话的消息列表
  const getCurrentMessages = () => {
    if (!currentSession) return [];
    const messages = [...(currentSession?.messages || [])];
    if (isStreaming && streamingMessage) {
      messages.push({
        role: 'assistant',
        content: streamingMessage,
        references: streamingReferences,
        isStreaming: true
      });
    }
    return messages;
  };

  // 加载中状态
  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-black">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">正在初始化会话...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-gray-900 via-gray-900 to-black">
      {/* 侧边栏 */}
      <div className="w-80 bg-black/30 backdrop-blur-xl border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <img src="/src/assets/icon_clean.png" width="40" height="40" alt="logo" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                赛博学长
              </h1>
              <p className="text-xs text-gray-500">沉浸式直播连麦</p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={createNewSession}
            disabled={isStreaming}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl py-3 flex items-center justify-center gap-2 text-white font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            申请连麦
          </motion.button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {Object.values(sessions).map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onSelect={() => !isStreaming && setCurrentSessionId(session.id)}
              onDelete={() => deleteSession(session.id)}
              isDeleting={deletingSessions[session.id]}
            />
          ))}
        </div>
        
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Zap className="w-3 h-3" />
            <span>流式响应 · 实时搜索</span>
          </div>
        </div>
      </div>
      
      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 头部 */}
        <div className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-sm px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">
              {currentSession?.title || '直播切片'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {currentSession?.messages?.length > 0 && !isStreaming && (
              <button
                onClick={clearCurrentSession}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
              >
                清空对话
              </button>
            )}
            {isStreaming && (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-gray-400">学长思考中...</span>
              </div>
            )}
          </div>
        </div>
        
        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {getCurrentMessages().length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-20 h-20 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-4"
              >
                <Sparkles className="w-10 h-10 text-blue-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">开始连麦</h2>
              <p className="text-gray-400">赛博学长给你最苹果的回答</p>
            </div>
          ) : (
            <>
              {getCurrentMessages().map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg.content}
                  isUser={msg.role === 'user'}
                  references={msg.references}
                  isStreaming={msg.isStreaming}
                />
              ))}
              {currentStatus && (
                <div className="flex justify-start pl-12">
                  <StatusCard 
                    message={currentStatus.message} 
                    icon={currentStatus.icon}
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* 输入区域 */}
        <div className="p-6 border-t border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isStreaming && sendMessage()}
              placeholder={isStreaming ? "学长正在组织语言..." : "直接说观点..."}
              disabled={isStreaming}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSendOrStop}
              disabled={!isStreaming && !inputMessage.trim()}
              className={`px-6 rounded-xl flex items-center gap-2 text-white font-medium transition-all ${
                isStreaming
                  ? 'bg-red-500 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/25'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg hover:shadow-blue-500/25'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isStreaming ? (
                <>
                  <Square className="w-4 h-4" />
                  停止
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  发送
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;