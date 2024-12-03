'use client';

import { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Button } from './ui/button';
import { createIssue, updateIssue, getLabels, createLabel, getGitHubConfig } from '@/lib/github';
import { useTheme } from 'next-themes';
import { Label, EditableIssue } from '@/types/github';
import { LABEL_COLORS } from '@/lib/colors';

interface IssueEditorProps {
  issue?: EditableIssue;
  onSave: () => void;
  onCancel: () => void;
}

export function IssueEditor({ issue, onSave, onCancel }: IssueEditorProps) {
  const [title, setTitle] = useState(issue?.title || '');
  const [content, setContent] = useState(issue?.body || '');
  const [saving, setSaving] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    issue?.labels?.map(label => label.name) || []
  );
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);
  const [newLabel, setNewLabel] = useState({
    name: '',
    color: LABEL_COLORS[0].color,
    description: ''
  });
  const [creatingLabel, setCreatingLabel] = useState(false);
  const labelDropdownRef = useRef<HTMLDivElement>(null);
  const labelButtonRef = useRef<HTMLButtonElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (labelButtonRef.current?.contains(event.target as Node)) {
        return;
      }
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

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const labelsData = await getLabels();
        setAvailableLabels(labelsData);
      } catch (error) {
        console.error('Error fetching labels:', error);
      }
    };
    fetchLabels();
  }, []);

  const handleSave = async () => {
    const config = await getGitHubConfig();
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
      setAvailableLabels(prev => [...prev, createdLabel]);
      setSelectedLabels(prev => [...prev, createdLabel.name]);
      setShowNewLabelForm(false);
      setNewLabel({ name: '', color: LABEL_COLORS[0].color, description: '' });
    } catch (error) {
      console.error('Error creating label:', error);
      alert('Failed to create label');
    } finally {
      setCreatingLabel(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full px-3 py-2 text-lg border border-default rounded-lg bg-bg-primary dark:bg-bg-secondary focus:outline-none focus:border-secondary dark:focus:border-secondary"
      />

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLabelDropdown(!showLabelDropdown)}
          className="border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
          ref={labelButtonRef}
        >
          Labels
        </Button>

        {showLabelDropdown && (
          <div ref={labelDropdownRef} className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-default bg-bg-primary dark:bg-bg-secondary shadow-card dark:shadow-card-dark">
            <div className="max-h-96 overflow-y-auto">
              {showNewLabelForm ? (
                <div className="p-3 border-b border-default">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newLabel.name}
                      onChange={(e) => setNewLabel(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Label name"
                      className="w-full px-2 py-1 text-sm border border-default rounded bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:border-secondary dark:focus:border-secondary"
                    />
                    <input
                      type="text"
                      value={newLabel.description}
                      onChange={(e) => setNewLabel(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description (optional)"
                      className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-[#373e47] rounded bg-white dark:bg-[#22272e] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7]"
                    />
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Color
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {LABEL_COLORS.map(({ color }) => (
                          <button
                            key={color}
                            onClick={() => setNewLabel(prev => ({ ...prev, color }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              newLabel.color === color 
                                ? 'border-secondary dark:border-secondary scale-110' 
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
                        <span className="text-xs text-text-secondary">
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
                          setNewLabel({ name: '', color: LABEL_COLORS[0].color, description: '' });
                        }}
                        className="text-xs py-1 px-2 border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
                        disabled={creatingLabel}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="success"
                        onClick={handleCreateLabel}
                        disabled={creatingLabel}
                        className="text-xs py-1 px-2"
                      >
                        {creatingLabel ? 'Creating...' : 'Create label'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="max-h-48 overflow-y-auto">
                    {availableLabels.map((label) => (
                      <button
                        key={label.name}
                        onClick={() => {
                          const isSelected = selectedLabels.includes(label.name);
                          setSelectedLabels(prev =>
                            isSelected
                              ? prev.filter(name => name !== label.name)
                              : [...prev, label.name]
                          );
                          if (isSelected) {
                            setShowLabelDropdown(false);
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary dark:hover:bg-bg-tertiary flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <span
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: `#${label.color}` }}
                          />
                          <span>{label.name}</span>
                        </div>
                        {selectedLabels.includes(label.name) && (
                          <span className="text-success">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-bg-secondary dark:hover:bg-bg-tertiary border-t border-default"
                    onClick={() => setShowNewLabelForm(true)}
                  >
                    Create new label
                  </button>
                </>
              )}
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
        className="!border !border-default !rounded-lg"
        data-color-mode={theme === 'dark' ? 'dark' : 'light'}
      />

      <div className="flex justify-end space-x-3">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
        >
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : issue ? 'Update issue' : 'Create issue'}
        </Button>
      </div>
    </div>
  );
} 