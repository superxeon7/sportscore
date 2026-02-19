'use client';

import React, { useState } from 'react';

interface Tab {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, defaultTab, onChange, className = '' }: TabsProps) {
  const [activeKey, setActiveKey] = useState(
    defaultTab || (tabs.length > 0 ? tabs[0].key : ''),
  );

  const handleTabClick = (key: string) => {
    setActiveKey(key);
    onChange?.(key);
  };

  const activeTab = tabs.find((t) => t.key === activeKey);

  return (
    <div className={className}>
      {/* Tab headers */}
      <div className="flex border-b border-white/10" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === activeKey}
            onClick={() => handleTabClick(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab.key === activeKey
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div className="py-4" role="tabpanel">
        {activeTab?.content}
      </div>
    </div>
  );
}
