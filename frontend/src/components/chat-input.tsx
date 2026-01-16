import { useState, useEffect } from 'react';
import { generateId } from '@lib/generate-id';
import { usePersistentChat } from '@/stores/chat';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/select';
import { ArrowUp, Sparkles } from 'lucide-react';

// Shared model type - should match chat-messages.tsx
type ModelType =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'qwen/qwen3-32b'
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distill-llama-70b';

const MODEL_OPTIONS: { value: ModelType; label: string; provider: string }[] = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google' },
  { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', provider: 'Groq' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'Groq' },
  { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', provider: 'Groq' },
];

export function ChatInput() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-2.5-flash');
  const { setCurrentChatId } = usePersistentChat();

  // Load saved model preference from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem('selectedModel') as ModelType | null;
    const validModels = MODEL_OPTIONS.map((m) => m.value);
    if (savedModel && validModels.includes(savedModel)) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('selectedModel', selectedModel);
    }
  }, [selectedModel]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newChatId = generateId();

    setCurrentChatId(newChatId);

    sessionStorage.setItem(`chat-initial-${newChatId}`, message.trim());
    sessionStorage.setItem(`chat-model-${newChatId}`, selectedModel);

    navigate(`/chat/${newChatId}`);

    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl">
        <div className="text-start mb-4">
          <h2 className="text-3xl font-bold text-foreground text-slate-900">
            Welcome, <span className="text-primary">{user?.name}</span>
          </h2>
        </div>
        <div className="relative">
          <form
            className="flex flex-col bg-white border border-border border-slate-900 rounded-[14px] shadow-lg p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!message.trim()) return;
              handleSend();
            }}
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your supermemory..."
              className="w-full text-foreground placeholder-slate-700 rounded-md outline-none resize-none text-base text-slate-900 leading-relaxed px-3 py-3 bg-transparent"
              rows={2}
            />
            <div className="flex items-center justify-between w-full pt-2">
              {/* Model Selector */}
              <Select
                value={selectedModel}
                onValueChange={(value: ModelType) => setSelectedModel(value)}
              >
                <SelectTrigger className="h-8 w-auto gap-1.5 border-none shadow-none bg-gray-100 hover:bg-gray-200 text-xs text-gray-700">
                  <Sparkles className="size-3.5 text-gray-500" />
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex items-center gap-2">
                        <span>{model.label}</span>
                        <span className="text-xs text-muted-foreground">({model.provider})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Submit Button */}
              <div className="bg-gray-500 rounded-xl">
                <Button
                  type="submit"
                  disabled={!message.trim()}
                  className="text-primary-foreground rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/90"
                  size="icon"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
