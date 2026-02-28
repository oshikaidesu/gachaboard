#!/usr/bin/env node

/**
 * 完了済みタスクのIssueを作成してクローズし、同期するスクリプト
 */

import { parseTaskBoard, createIssue } from './create-issues.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getExistingIssues() {
  try {
    const output = execSync('gh issue list --state all --json number,title --limit 500', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    return JSON.parse(output);
  } catch (error) {
    return [];
  }
}

function findIssueByTaskId(issues, taskId) {
  return issues.find(issue => {
    const titleMatch = issue.title.match(/^\[([PX]\d+-\d+)\]/);
    return titleMatch && titleMatch[1] === taskId;
  });
}

function closeIssue(issueNumber) {
  try {
    execSync(`gh issue close ${issueNumber} --comment "完了済みタスクのためクローズ"`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const tasks = parseTaskBoard();
  const existingIssues = getExistingIssues();
  
  // Phase 1-3の完了タスクを取得
  const completedTasks = tasks.filter(t => 
    (t.phase === '1' || t.phase === '2' || t.phase === '3') && t.isCompleted
  );
  
  console.log(`完了タスク数: ${completedTasks.length}`);
  
  for (const task of completedTasks) {
    const existing = findIssueByTaskId(existingIssues, task.id);
    
    if (existing) {
      // Issueが既に存在する場合、クローズされているか確認
      try {
        const issueDetail = JSON.parse(execSync(`gh issue view ${existing.number} --json state`, {
          encoding: 'utf-8',
          cwd: path.join(__dirname, '..')
        }));
        
        if (issueDetail.state === 'OPEN') {
          console.log(`Issue #${existing.number} (${task.id}) をクローズ中...`);
          if (closeIssue(existing.number)) {
            console.log(`  ✓ クローズしました`);
          }
        } else {
          console.log(`Issue #${existing.number} (${task.id}) は既にクローズ済み`);
        }
      } catch (error) {
        console.error(`  ✗ Issue #${existing.number} の確認に失敗:`, error.message);
      }
    } else {
      // Issueが存在しない場合、作成してクローズ
      console.log(`Issueを作成中: ${task.id} - ${task.title}`);
      const issueNumber = createIssue(task, false);
      if (issueNumber && issueNumber !== '作成済み' && !isNaN(parseInt(issueNumber))) {
        // 少し待ってからクローズ
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (closeIssue(issueNumber)) {
          console.log(`  ✓ Issue #${issueNumber} を作成してクローズしました`);
        }
      }
    }
  }
  
  console.log('\n完了！同期スクリプトを実行してください: node scripts/sync-issues-with-board.js');
}

main();

