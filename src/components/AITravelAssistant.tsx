'use client';

import { useState } from 'react';
import type { Trip, TripPreferences, ItineraryDayRecord, ItineraryItem } from '@/lib/types';
import {
  Sparkles, X, Send, Bot, User, ArrowRight, Check,
  Clock, MapPin, Compass, AlertCircle, Loader2
} from 'lucide-react';

interface AITravelAssistantProps {
  trip: Trip | null;
  preferences: TripPreferences | null;
  days: ItineraryDayRecord[];
  items: ItineraryItem[];
  isOpen: boolean;
  onClose: () => void;
  onAddSuggestedItem: (item: {
    label: string;
    dayId?: string;
    type: 'activity' | 'dining' | 'hotel' | 'transfer';
    cost: number;
    description: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
  actionCard?: {
    type: 'add_item' | 'regenerate';
    title: string;
    subtitle: string;
    payload?: any;
  };
}

export default function AITravelAssistant({
  trip,
  preferences,
  days,
  items,
  isOpen,
  onClose,
  onAddSuggestedItem,
  onRegenerate,
}: AITravelAssistantProps) {
  const destination = trip?.destination || 'your destination';
  const destLower = destination.toLowerCase();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionDone, setActionDone] = useState<Record<string, boolean>>({});

  const defaultSuggestions = destLower.includes('alibag')
    ? [
        '🏖️ Add Kolaba Fort during low tide',
        '🦞 Best local seafood dinner recommendation',
        '⚡ Slow down the pace on Day 2',
        '🌅 Find the best sunset beach in Alibag',
      ]
    : [
        '🏖️ Add beach sunset spot for Day 1',
        '🍽️ Recommend top-rated dinner spot',
        '⚡ Re-optimize daily route to reduce driving',
        '💡 What are must-visit highlights here?',
      ];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I'm your AI Travel Companion for **${trip?.name || 'this trip'}** to **${destination}**. How can I help fine-tune your itinerary today?`,
      time: 'Just now',
    },
  ]);

  async function handleSend(customText?: string) {
    const query = (customText || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // AI logic response simulation with domain intelligence
    setTimeout(async () => {
      let aiText = '';
      let actionCard: Message['actionCard'] = undefined;

      const q = query.toLowerCase();

      if (q.includes('kolaba') || q.includes('fort') || (q.includes('beach') && destLower.includes('alibag'))) {
        aiText = `For Alibag, **Kolaba Fort** is a historical sea fortress built by Shivaji Maharaj. It is located 1–2 km offshore from Alibag Beach and can be reached by walking during low tide or via horse cart! I've prepped a scheduled stop for you.`;
        actionCard = {
          type: 'add_item',
          title: 'Add Kolaba Sea Fort',
          subtitle: 'Day 1 • 04:30 PM • 2 hrs • ~$5 entry',
          payload: {
            label: 'Kolaba Sea Fort & Walkway',
            dayId: days[0]?.id,
            type: 'activity',
            cost: 5,
            description: 'Historic sea fortress with scenic views, accessible via tidal walkway.',
            locationName: 'Kolaba Sea Fort',
            latitude: 18.6300,
            longitude: 72.8600,
          },
        };
      } else if (q.includes('seafood') || q.includes('dinner') || q.includes('food') || q.includes('eat')) {
        aiText = `In ${destination}, the standout culinary spot is **Sanman Seafood Restaurant** (famous for Konkani Gomantak fish thalis and butter garlic crabs) or a relaxed seaside table at **Varsoli Beach Cafe**.`;
        actionCard = {
          type: 'add_item',
          title: 'Add Sanman Seafood Dinner',
          subtitle: 'Day 1 • 08:00 PM • ~$18 per person',
          payload: {
            label: 'Sanman Local Seafood Dinner',
            dayId: days[0]?.id,
            type: 'dining',
            cost: 20,
            description: 'Authentic Konkani seafood thalis and coastal specialties.',
            locationName: 'Sanman Restaurant',
            latitude: 18.6450,
            longitude: 72.8740,
          },
        };
      } else if (q.includes('slow') || q.includes('pace') || q.includes('relax') || q.includes('optimize')) {
        aiText = `I can re-balance your daily schedule into a **Relaxed Pace**, grouping nearby stops and inserting comfortable 1-hour rest buffers between activities.`;
        actionCard = {
          type: 'regenerate',
          title: 'Re-balance into Relaxed Pace',
          subtitle: 'Automatically spaces out activities & optimizes drive times',
        };
      } else if (q.includes('sunset') || q.includes('view')) {
        aiText = `The premier sunset experience in ${destination} is at **Varsoli Beach** or the cliffs overlooking **Kihim**. White sand, calm waves, and beachfront cafes.`;
        actionCard = {
          type: 'add_item',
          title: 'Add Varsoli Sunset Stroll',
          subtitle: 'Day 2 • 05:45 PM • Free',
          payload: {
            label: 'Varsoli Beach Sunset Stroll',
            dayId: days[1]?.id || days[0]?.id,
            type: 'activity',
            cost: 0,
            description: 'Spectacular Arabian sea sunset with soft white sands and gentle surf.',
            locationName: 'Varsoli Beach',
            latitude: 18.6600,
            longitude: 72.8700,
          },
        };
      } else {
        aiText = `Based on your ${preferences?.travel_style || 'Balanced'} trip to ${destination} with ${items.length} current stops, you have plenty of room for flexibility. You can ask me to suggest dining, add beach spots, or balance driving times!`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionCard,
        },
      ]);
      setLoading(false);
    }, 700);
  }

  async function handleExecuteAction(msgId: string, actionCard: Message['actionCard']) {
    if (!actionCard || actionDone[msgId]) return;

    setActionDone(prev => ({ ...prev, [msgId]: true }));

    if (actionCard.type === 'add_item' && actionCard.payload) {
      await onAddSuggestedItem(actionCard.payload);
    } else if (actionCard.type === 'regenerate') {
      await onRegenerate();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white/95 backdrop-blur-xl border-l border-slate-200/90 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/60 to-purple-50/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">AI Travel Sidecar</h3>
            <p className="text-[11px] text-slate-500">Planning {destination}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                  : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/70'
              }`}
            >
              <div className="whitespace-pre-line font-normal">{msg.text}</div>
            </div>

            {/* Action Card Attachment */}
            {msg.actionCard && (
              <div className="mt-2 max-w-[85%] w-full bg-white rounded-xl border border-indigo-100 p-3 shadow-xs space-y-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Suggested Action
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">{msg.actionCard.title}</h4>
                  <p className="text-[11px] text-slate-500">{msg.actionCard.subtitle}</p>
                </div>
                <button
                  onClick={() => handleExecuteAction(msg.id, msg.actionCard)}
                  disabled={actionDone[msg.id]}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    actionDone[msg.id]
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                  }`}
                >
                  {actionDone[msg.id] ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Added to Itinerary!</span>
                    </>
                  ) : (
                    <>
                      <span>Apply to Itinerary</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>AI Assistant is analyzing route...</span>
          </div>
        )}
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {defaultSuggestions.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSend(sug)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 whitespace-nowrap transition"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask AI or request a schedule change..."
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
