import React from 'react';
import { Task } from '../types';
import { ChartBarIcon, MailIcon, DocumentTextIcon, TableIcon } from './Icons';

interface TaskAssetDisplayProps {
  asset: Task['asset'];
}

const AssetIcon: React.FC<{ type: 'infographic' | 'email_thread' | 'spreadsheet_data' | 'document' }> = ({ type }) => {
  switch (type) {
    case 'infographic':
      return <ChartBarIcon className="w-6 h-6 text-indigo-400" />;
    case 'email_thread':
      return <MailIcon className="w-6 h-6 text-rose-400" />;
    case 'spreadsheet_data':
      return <TableIcon className="w-6 h-6 text-emerald-400" />;
    case 'document':
    default:
      return <DocumentTextIcon className="w-6 h-6 text-sky-400" />;
  }
};

const TaskAssetDisplay: React.FC<TaskAssetDisplayProps> = ({ asset }) => {
  if (!asset) return null;

  return (
    <div className="mt-4">
      <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <AssetIcon type={asset.type} />
          <h4 className="font-semibold text-slate-300">{asset.title || 'Attached Document'}</h4>
        </div>
        <div className="text-sm text-slate-400 bg-slate-900 p-3 rounded-md max-h-60 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-sans">{asset.content}</pre>
        </div>
      </div>
    </div>
  );
};

export default TaskAssetDisplay;
