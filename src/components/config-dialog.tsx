'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { getGitHubConfig, setGitHubConfig } from '@/lib/github';
import { verifyPassword, isPasswordVerified } from '@/lib/db';
import { GitHubConfig } from '@/types/github';

interface ConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigDialog({ isOpen, onClose }: ConfigDialogProps) {
  const [config, setConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getGitHubConfig().then(setConfig);
      setPasswordVerified(isPasswordVerified());
    }
  }, [isOpen]);

  const handleVerifyPassword = async () => {
    if (!password) {
      alert('Please enter password');
      return;
    }

    setVerifying(true);
    try {
      const isValid = await verifyPassword(password);
      if (isValid) {
        setPasswordVerified(true);
        alert('Password verified successfully!');
      } else {
        alert('Invalid password');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      alert('Failed to verify password');
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!config.owner || !config.repo || !config.token) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await setGitHubConfig({
        ...config,
        password: password
      });
      onClose();
      // 刷新页面以应用新配置
      window.location.reload();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-bg-primary dark:bg-bg-secondary rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-text-primary">Repository Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Repository Owner
              </label>
              <input
                type="text"
                value={config.owner}
                onChange={(e) => setConfig(prev => ({ ...prev, owner: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:border-secondary dark:focus:border-secondary"
                placeholder="e.g. octocat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Repository Name
              </label>
              <input
                type="text"
                value={config.repo}
                onChange={(e) => setConfig(prev => ({ ...prev, repo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:border-secondary dark:focus:border-secondary"
                placeholder="e.g. hello-world"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                GitHub Token
              </label>
              <input
                type="password"
                value={config.token}
                onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:border-secondary dark:focus:border-secondary"
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Need a token? <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Create one here</a>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Password
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-default rounded-lg bg-bg-primary dark:bg-bg-tertiary focus:outline-none focus:border-secondary dark:focus:border-secondary"
                  placeholder="Enter password"
                />
                <button
                  onClick={handleVerifyPassword}
                  disabled={verifying}
                  className="px-3 py-2 text-sm font-medium text-white bg-secondary hover:bg-opacity-90 rounded-lg disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {passwordVerified && (
                <p className="mt-1 text-xs text-success">Password verified successfully!</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-primary dark:bg-bg-tertiary border border-default rounded-lg hover:bg-bg-secondary dark:hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-opacity-90 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 