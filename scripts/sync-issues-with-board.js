#!/usr/bin/env node

/**
 * GitHub Issueの状態とmaster-task-board.mdのチェックボックスを同期するスクリプト
 * 
 * 使用方法:
 *   node scripts/sync-issues-with-board.js [--close-issues]
 * 
 * --close-issues: チェック済みのタスクに対応するIssueをクローズします
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_BOARD_PATH = path.join(__dirname, '..', 'IMPLEMENTATION_PHASES', 'master-task-board.md');

// GitHub Issueを取得
function getIssues() {
  try {
    const output = execSync('gh issue list --state all --json number,title,state,labels --limit 500', { 
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

// Issueをクローズ
function closeIssue(issueNumber) {
  try {
    execSync(`gh issue close ${issueNumber}`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    console.log(`  ✓ Issue #${issueNumber} をクローズしました`);
    return true;
  } catch (error) {
    console.error(`  ✗ Issue #${issueNumber} のクローズに失敗:`, error.message);
    return false;
  }
}

function syncTaskBoard(closeIssues = false) {
  const content = fs.readFileSync(TASK_BOARD_PATH, 'utf-8');
  const issues = getIssues();
  
  console.log(`取得したIssue数: ${issues.length}`);
  
  const lines = content.split(/\r?\n/);
  const updatedLines = [];
  let updatedCount = 0;
  let closedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // チェックボックス行を検出: `- [ ]` または `- [x]`（Issueリンク形式にも対応）
    const uncheckedMatch = line.match(/^- \[ \] (([PX]\d+-\d+)\s+.+?)(\s+\[#\d+\]\(.+\))?$/);
    const checkedMatch = line.match(/^- \[x\] (([PX]\d+-\d+)\s+.+?)(\s+\[#\d+\]\(.+\))?$/);
    
    if (uncheckedMatch || checkedMatch) {
      const taskId = uncheckedMatch ? uncheckedMatch[2] : checkedMatch[2];
      const issue = findIssueByTaskId(issues, taskId);
      
      if (issue) {
        // Issueがクローズされている場合、チェックボックスをチェック済みに
        if (issue.state === 'CLOSED' && uncheckedMatch) {
          const issueLink = issue.number ? ` (#${issue.number})` : '';
          updatedLines.push(line.replace(/^- \[ \]/, '- [x]'));
          updatedCount++;
          console.log(`  [x] ${taskId}: ${issue.title} (#${issue.number})`);
        }
        // Issueがオープンで、チェックボックスがチェック済みの場合、Issueをクローズ
        else if (issue.state === 'OPEN' && checkedMatch && closeIssues) {
          if (closeIssue(issue.number)) {
            closedCount++;
          }
          updatedLines.push(line);
        }
        // チェックボックスがチェック済みでIssueがクローズ済みの場合、そのまま
        else if (issue.state === 'CLOSED' && checkedMatch) {
          updatedLines.push(line);
        }
        // その他の場合はそのまま
        else {
          updatedLines.push(line);
        }
      } else {
        // Issueが見つからない場合はそのまま
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }
  
  if (updatedCount > 0 || closedCount > 0) {
    // バックアップを作成
    const backupPath = TASK_BOARD_PATH + '.backup';
    fs.writeFileSync(backupPath, content, 'utf-8');
    console.log(`\nバックアップを作成: ${backupPath}`);
    
    // 更新
    const updatedContent = updatedLines.join('\n');
    fs.writeFileSync(TASK_BOARD_PATH, updatedContent, 'utf-8');
    console.log(`更新完了: ${TASK_BOARD_PATH}`);
    console.log(`\n更新内容:`);
    console.log(`  - チェックボックス更新: ${updatedCount}件`);
    if (closeIssues) {
      console.log(`  - Issueクローズ: ${closedCount}件`);
    }
  } else {
    console.log('\n更新する項目はありませんでした');
  }
}

// 手動でタスクをチェック済みにする関数
function markTaskAsDone(taskId) {
  const content = fs.readFileSync(TASK_BOARD_PATH, 'utf-8');
  const lines = content.split(/\r?\n/);
  let found = false;
  
  const updatedLines = lines.map(line => {
    const match = line.match(/^- \[ \] (([PX]\d+-\d+)\s+.+?)(\s+\(#\d+\))?$/);
    if (match && match[2] === taskId) {
      found = true;
      return line.replace(/^- \[ \]/, '- [x]');
    }
    return line;
  });
  
  if (found) {
    const backupPath = TASK_BOARD_PATH + '.backup';
    fs.writeFileSync(backupPath, content, 'utf-8');
    fs.writeFileSync(TASK_BOARD_PATH, updatedLines.join('\n'), 'utf-8');
    console.log(`✓ ${taskId} をチェック済みにしました`);
    
    // 対応するIssueをクローズ
    const issues = getIssues();
    const issue = findIssueByTaskId(issues, taskId);
    if (issue && issue.state === 'OPEN') {
      if (closeIssue(issue.number)) {
        console.log(`✓ 対応するIssue #${issue.number} をクローズしました`);
      }
    }
  } else {
    console.log(`✗ タスク ${taskId} が見つかりませんでした`);
  }
}

// メイン処理
const args = process.argv.slice(2);
const closeIssues = args.includes('--close-issues');
const markTask = args.find(arg => arg.startsWith('--mark='))?.split('=')[1];

if (markTask) {
  markTaskAsDone(markTask);
} else {
  syncTaskBoard(closeIssues);
}

