'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getGitHubConfig, setGitHubConfig } from '@/lib/github';
import { verifyPassword, isPasswordVerified, setPasswordVerified as setPasswordVerifiedState } from '@/lib/api';
import { GitHubConfig } from '@/types/github';
import { toast } from 'sonner';

interface ConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  const [config, setConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    issuesPerPage: 10
  });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getGitHubConfig()
        .then(config => {
          setConfig(prev => ({
            ...prev,
            owner: config.owner,
            repo: config.repo,
            issuesPerPage: config.issuesPerPage
          }));
        })
        .catch(() => {
          toast.error('Failed to load configuration');
        });
      setPasswordVerified(isPasswordVerified());
    }
  }, [isOpen]);

  const handleVerifyPassword = async () => {
    if (!password) {
      toast.error('Please enter password');
      return;
    }

    setVerifying(true);
    try {
      const isValid = await verifyPassword(password);
      if (isValid) {
        setPasswordVerified(true);
        setPasswordVerifiedState(true);
        toast.success('Password verified successfully');
      } else {
        toast.error('Invalid password');
      }
    } catch {
      toast.error('Failed to verify password');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!config.owner || !config.repo) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await setGitHubConfig(config);
      toast.success('Configuration saved successfully');
      onClose();
      // 刷新页面以应用新配置
      window.location.reload();
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-bg-primary dark:bg-bg-secondary rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        {/* 标题 */}
        <div className="px-6 py-4 border-b border-default bg-bg-primary dark:bg-bg-secondary">
          <h2 className="text-xl font-semibold text-text-primary">Repository Settings</h2>
          <p className="mt-1 text-sm text-text-secondary">Configure your GitHub repository settings</p>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-5">
          {/* Repository Owner */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Repository Owner <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={config.owner}
              onChange={(e) => setConfig(prev => ({ ...prev, owner: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:ring-1 focus:ring-secondary dark:focus:ring-secondary transition-shadow"
              placeholder="e.g. octocat"
            />
          </div>

          {/* Repository Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Repository Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={config.repo}
              onChange={(e) => setConfig(prev => ({ ...prev, repo: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:ring-1 focus:ring-secondary dark:focus:ring-secondary transition-shadow"
              placeholder="e.g. hello-world"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Password Verification
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:ring-1 focus:ring-secondary dark:focus:ring-secondary transition-shadow"
                placeholder="Enter password"
              />
              <Button
                onClick={handleVerifyPassword}
                disabled={verifying}
                variant="outline"
                className={`min-w-[80px] border-default hover:bg-bg-tertiary dark:hover:bg-bg-tertiary transition-colors ${passwordVerified ? 'bg-success/10 border-success text-success hover:bg-success/20' : ''}`}
              >
                {verifying ? 'Verifying...' : passwordVerified ? 'Verified' : 'Verify'}
              </Button>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-bg-primary dark:bg-bg-secondary border-t border-default flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary transition-colors"
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={saving}
            className="min-w-[80px] hover:opacity-90 transition-opacity"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
} 