#!/usr/bin/env node

/**
 * GitHub Issueの番号をmaster-task-board.mdに追加するスクリプト
 * 
 * 使用方法:
 *   node scripts/update-task-board-with-issues.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_BOARD_PATH = path.join(__dirname, '..', 'IMPLEMENTATION_PHASES', 'master-task-board.md');

// GitHub Issueを取得（クローズ済みも含む）
function getIssues() {
  try {
    const output = execSync('gh issue list --state all --json number,title,labels --limit 500', { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    return JSON.parse(output);
  } catch (error) {
    console.error('Issue取得エラー:', error.message);
    return [];
  }
}

// タスクIDからIssueを検索
function findIssueByTaskId(issues, taskId) {
  return issues.find(issue => {
    const titleMatch = issue.title.match(/^\[([PX]\d+-\d+)\]/);
    return titleMatch && titleMatch[1] === taskId;
  });
}

function updateTaskBoard() {
  const content = fs.readFileSync(TASK_BOARD_PATH, 'utf-8');
  const issues = getIssues();
  
  console.log(`取得したIssue数: ${issues.length}`);
  
  // リポジトリ情報を取得
  let repoUrl = 'https://github.com/oshikaidesu/gachaboard';
  try {
    const remoteUrl = execSync('git remote get-url origin', { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    }).trim();
    // git@github.com:user/repo.git または https://github.com/user/repo.git からURLを抽出
    const match = remoteUrl.match(/(?:github\.com[/:]|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      repoUrl = `https://github.com/${match[1]}`;
    }
  } catch (error) {
    console.log('リポジトリURLの取得に失敗、デフォルト値を使用:', repoUrl);
  }

  // タスクIDパターンにマッチする行をIssue番号で更新
  const lines = content.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    // `- [ ] P0-01 タイトル` または `- [x] P0-01 タイトル` の形式を更新
    const uncheckedMatch = line.match(/^- \[ \] (([PX]\d+-\d+)\s+.+?)(\s+\(#\d+\)|\s+\[#\d+\]\(.+\))?$/);
    const checkedMatch = line.match(/^- \[x\] (([PX]\d+-\d+)\s+.+?)(\s+\(#\d+\)|\s+\[#\d+\]\(.+\))?$/);
    
    if (uncheckedMatch || checkedMatch) {
      const taskId = uncheckedMatch ? uncheckedMatch[2] : checkedMatch[2];
      const issue = findIssueByTaskId(issues, taskId);
      if (issue) {
        // 既にIssueリンクが含まれているか確認
        const hasLink = line.includes(`[#${issue.number}]`) || line.includes(`(#${issue.number})`);
        if (!hasLink) {
          // Issueリンクが含まれていない場合、追加
          const checkbox = uncheckedMatch ? '- [ ]' : '- [x]';
          const title = uncheckedMatch ? uncheckedMatch[1] : checkedMatch[1];
          const issueLink = `[#${issue.number}](${repoUrl}/issues/${issue.number})`;
          return `${checkbox} ${title} ${issueLink}`;
        } else {
          // 既にリンクがある場合は、正しい形式に更新
          const checkbox = uncheckedMatch ? '- [ ]' : '- [x]';
          const title = uncheckedMatch ? uncheckedMatch[1] : checkedMatch[1];
          const issueLink = `[#${issue.number}](${repoUrl}/issues/${issue.number})`;
          const cleanTitle = title.replace(/\s+\(#\d+\)|\s+\[#\d+\]\(.+\)/g, '').trim();
          return `${checkbox} ${cleanTitle} ${issueLink}`;
        }
      }
    }
    return line;
  });
  
  const updatedContent = updatedLines.join('\n');
  
  // バックアップを作成
  const backupPath = TASK_BOARD_PATH + '.backup';
  fs.writeFileSync(backupPath, content, 'utf-8');
  console.log(`バックアップを作成: ${backupPath}`);
  
  // 更新
  fs.writeFileSync(TASK_BOARD_PATH, updatedContent, 'utf-8');
  console.log(`更新完了: ${TASK_BOARD_PATH}`);
}

updateTaskBoard();

