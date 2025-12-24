
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Bot, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface TitleChatProps {
  onTitlesGenerated: (data: { titles: string[], referenceVideos: any[] }) => void;
}

export const TitleChat: React.FC<TitleChatProps> = ({ onTitlesGenerated }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hi! I'm your AI title generator. Paste your video script or describe your content, and I'll analyze successful patterns from your database to create compelling titles for you.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-titles', {
        body: { userScript: input }
      });

      if (error) throw error;

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `I've analyzed your content and found patterns from ${data.referenceVideos?.length || 0} successful videos in your database. Here are 8 optimized titles based on proven frameworks that work for your niche:\n\n${data.titles.map((title: string, i: number) => `${i + 1}. ${title}`).join('\n')}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
      onTitlesGenerated(data);

      toast({
        title: "Titles Generated!",
        description: `Created ${data.titles.length} AI-powered title suggestions`
      });
    } catch (error) {
      console.error('Error generating titles:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "I apologize, but I encountered an error while generating titles. Please try again with your script.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: "Failed to generate titles. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f] rounded-lg border border-[#272727]">
      {/* Chat Header */}
      <div className="p-4 border-b border-[#272727]">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#cc0000]" />
          <h3 className="text-white font-semibold">AI Title Generator</h3>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 ${
              message.type === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === 'user' 
                ? 'bg-[#cc0000]' 
                : 'bg-gradient-to-r from-[#cc0000] to-[#aa0000]'
            }`}>
              {message.type === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              message.type === 'user'
                ? 'bg-[#cc0000] text-white'
                : 'bg-[#181818] text-[#f1f1f1] border border-[#272727]'
            }`}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#cc0000] to-[#aa0000] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#181818] text-[#f1f1f1] border border-[#272727] p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-[#cc0000] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Analyzing patterns...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[#272727]">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your video script or describe your content here..."
            className="flex-1 bg-[#0f0f0f] border-[#272727] text-white placeholder:text-[#666666] resize-none focus:border-[#cc0000]"
            rows={3}
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-[#cc0000] hover:bg-[#aa0000] text-white px-4 self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
