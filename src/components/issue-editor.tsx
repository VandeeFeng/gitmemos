'use client';

import { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Button } from './ui/button';
import { createIssue, updateIssue, getLabels, createLabel, getGitHubConfig } from '@/lib/github';
import { useTheme } from 'next-themes';
import { Label, EditableIssue } from '@/types/github';

interface IssueEditorProps {
  issue?: EditableIssue;
  onSave: () => void;
  onCancel: () => void;
}

const GITHUB_LABEL_COLORS = [
  { name: 'Label red', color: 'b60205' },
  { name: 'Label orange', color: 'd93f0b' },
  { name: 'Label yellow', color: 'fbca04' },
  { name: 'Label green', color: '0e8a16' },
  { name: 'Label mint', color: '98ff98' },
  { name: 'Label teal', color: '006b75' },
  { name: 'Label light blue', color: 'c5def5' },
  { name: 'Label blue', color: '0075ca' },
  { name: 'Label purple', color: '6f42c1' },
  { name: 'Label pink', color: 'ff69b4' },
  { name: 'Label gray', color: 'bfdadc' },
];

export function IssueEditor({ issue, onSave, onCancel }: IssueEditorProps) {
  const [title, setTitle] = useState(issue?.title || '');
  const [content, setContent] = useState(issue?.body || '');
  const [saving, setSaving] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    issue?.labels?.map(label => label.name) || []
  );
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [newLabel, setNewLabel] = useState({
    name: '',
    color: GITHUB_LABEL_COLORS[0].color,
    description: ''
  });
  const [creatingLabel, setCreatingLabel] = useState(false);
  const { theme } = useTheme();
  const labelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config = getGitHubConfig(false);
    setIsConfigured(Boolean(config.token && config.owner && config.repo));
  }, []);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const labelsData = await getLabels();
        setLabels(labelsData);
      } catch (error) {
        console.error('Error fetching labels:', error);
      }
    };
    fetchLabels();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
        setShowNewLabelForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSave = async () => {
    const config = getGitHubConfig(false);
    if (!config.token || !config.owner || !config.repo) {
      alert('Please configure your GitHub settings first');
      return;
    }

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setSaving(true);
    try {
      if (issue?.number) {
        await updateIssue(issue.number, title, content, selectedLabels);
      } else {
        await createIssue(title, content, selectedLabels);
      }
      onSave();
    } catch (error) {
      console.error('Error saving issue:', error);
      alert('Failed to save issue');
    } finally {
      setSaving(false);
    }
  };

  const toggleLabel = (labelName: string) => {
    const isRemoving = selectedLabels.includes(labelName);
    setSelectedLabels(prev => 
      isRemoving
        ? prev.filter(name => name !== labelName)
        : [...prev, labelName]
    );
    if (isRemoving) {
      setShowLabelDropdown(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) {
      alert('Please enter a label name');
      return;
    }

    setCreatingLabel(true);
    try {
      const createdLabel = await createLabel(
        newLabel.name,
        newLabel.color,
        newLabel.description || undefined
      );
      setLabels(prev => [...prev, createdLabel]);
      setSelectedLabels(prev => [...prev, createdLabel.name]);
      setShowNewLabelForm(false);
      setNewLabel({ name: '', color: GITHUB_LABEL_COLORS[0].color, description: '' });
    } catch (error) {
      console.error('Error creating label:', error);
      alert('Failed to create label');
    } finally {
      setCreatingLabel(false);
    }
  };

  return (
    <div className="p-6 space-y-4" data-color-mode={theme}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Issue title"
        className="w-full px-3 py-2 text-base border border-gray-200 dark:border-[#373e47] rounded-lg bg-white dark:bg-[#22272e] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7] transition-colors"
      />
      
      <div className="relative" ref={labelDropdownRef}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowLabelDropdown(!showLabelDropdown)}
          className="text-[#57606a] dark:text-[#768390] border-gray-200 dark:border-[#373e47] hover:bg-[#f6f8fa] dark:hover:bg-[#2d333b] hover:text-[#24292f] dark:hover:text-[#adbac7]"
        >
          Labels
        </Button>
        
        {selectedLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedLabels.map(labelName => {
              const label = labels.find(l => l.name === labelName);
              if (!label) return null;
              return (
                <span
                  key={label.id}
                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                    border: `1px solid #${label.color}40`
                  }}
                  onClick={() => toggleLabel(label.name)}
                >
                  {label.name}
                  <svg className="w-3 h-3 ml-1" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </span>
              );
            })}
          </div>
        )}

        {showLabelDropdown && (
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 dark:border-[#373e47] bg-white dark:bg-[#2d333b] shadow-lg">
            <div className="max-h-96 overflow-y-auto">
              {showNewLabelForm ? (
                <div className="p-3 border-b border-gray-200 dark:border-[#373e47]">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newLabel.name}
                      onChange={(e) => setNewLabel(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Label name"
                      className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-[#373e47] rounded bg-white dark:bg-[#22272e] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7]"
                    />
                    <input
                      type="text"
                      value={newLabel.description}
                      onChange={(e) => setNewLabel(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-[#373e47] rounded bg-white dark:bg-[#22272e] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7]"
                    />
                    <div>
                      <label className="block text-xs text-[#57606a] dark:text-[#768390] mb-1">
                        Color
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {GITHUB_LABEL_COLORS.map(({ color }) => (
                          <button
                            key={color}
                            onClick={() => setNewLabel(prev => ({ ...prev, color }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              newLabel.color === color 
                                ? 'border-[#0969da] dark:border-[#2f81f7] scale-110' 
                                : 'border-transparent hover:scale-110'
                            }`}
                          >
                            <span
                              className="block w-full h-full rounded-full"
                              style={{ backgroundColor: `#${color}` }}
                            />
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center">
                        <span
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: `#${newLabel.color}` }}
                        />
                        <span className="text-xs text-[#57606a] dark:text-[#768390]">
                          #{newLabel.color}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowNewLabelForm(false);
                          setNewLabel({ name: '', color: GITHUB_LABEL_COLORS[0].color, description: '' });
                        }}
                        className="text-xs py-1 px-2"
                        disabled={creatingLabel}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleCreateLabel}
                        disabled={creatingLabel}
                        className="text-xs py-1 px-2 bg-[#2da44e] hover:bg-[#2c974b] text-white border-0"
                      >
                        {creatingLabel ? 'Creating...' : 'Create label'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full px-3 py-2 text-left text-sm text-[#0969da] dark:text-[#2f81f7] hover:bg-[#f6f8fa] dark:hover:bg-[#373e47] border-b border-gray-200 dark:border-[#373e47]"
                  onClick={() => setShowNewLabelForm(true)}
                >
                  Create new label
                </button>
              )}
              
              <div className="py-1">
                {labels.length === 0 ? (
                  <div className="px-3 py-2 text-center text-sm text-[#57606a] dark:text-[#768390]">
                    No labels found
                  </div>
                ) : (
                  <div className="py-1">
                    {labels.map((label) => (
                      <button
                        key={label.id}
                        className={`w-full px-3 py-2 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#373e47] ${
                          selectedLabels.includes(label.name) ? 'bg-[#f6f8fa] dark:bg-[#373e47]' : ''
                        }`}
                        onClick={() => toggleLabel(label.name)}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `#${label.color}` }}
                          />
                          <span className="text-sm text-[#24292f] dark:text-[#adbac7] truncate">
                            {label.name}
                          </span>
                        </div>
                        {label.description && (
                          <p className="mt-0.5 text-xs text-[#57606a] dark:text-[#768390] truncate pl-5">
                            {label.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <MDEditor
        value={content}
        onChange={(val: string | undefined) => setContent(val || '')}
        preview="live"
        height={400}
        visibleDragbar={false}
        className="!border !border-gray-200 dark:!border-[#373e47] !rounded-lg"
      />
      <div className="flex justify-end space-x-3">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          disabled={saving}
          className="border-gray-200 dark:border-[#373e47] hover:bg-gray-50 dark:hover:bg-[#2d333b]"
        >
          Cancel
        </Button>
        <div className="relative group">
          <Button 
            onClick={handleSave} 
            disabled={saving || !isConfigured}
            className="bg-[#2da44e] hover:bg-[#2c974b] text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : !isConfigured ? 'Login Required' : issue?.number ? 'Update' : 'Create'}
          </Button>
          {!isConfigured && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              Please configure your GitHub settings first
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                <div className="border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 