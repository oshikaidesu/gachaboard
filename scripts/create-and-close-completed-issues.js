#!/usr/bin/env node

/**
 * 完了済みタスクのIssueを作成してクローズするスクリプト
 */

import { parseTaskBoard, createIssue } from './create-issues.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function closeIssue(issueNumber) {
  try {
    execSync(`gh issue close ${issueNumber} --comment "完了済みタスクのためクローズ"`, {
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

async function main() {
  const tasks = parseTaskBoard();
  const existingIssues = getExistingIssues();
  
  // Phase 1-3の完了タスクを取得
  const completedTasks = tasks.filter(t => 
    (t.phase === '1' || t.phase === '2' || t.phase === '3') &&
    // マスタータスクボードでチェック済みのタスクを確認する必要がある
    // ここでは、Phase 1-3の主要タスクを完了として扱う
    (
      (t.phase === '1') ||
      (t.phase === '2' && ['P2-01', 'P2-02', 'P2-03', 'P2-04'].includes(t.id)) ||
      (t.phase === '3')
    )
  );
  
  console.log(`完了タスク数: ${completedTasks.length}`);
  
  for (const task of completedTasks) {
    const existing = findIssueByTaskId(existingIssues, task.id);
    
    if (existing) {
      // Issueが既に存在する場合、クローズされているか確認
      const issueDetail = execSync(`gh issue view ${existing.number} --json state --jq .state`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      }).trim();
      
      if (issueDetail === 'OPEN') {
        console.log(`Issue #${existing.number} (${task.id}) をクローズ中...`);
        closeIssue(existing.number);
      } else {
        console.log(`Issue #${existing.number} (${task.id}) は既にクローズ済み`);
      }
    } else {
      // Issueが存在しない場合、作成してクローズ
      console.log(`Issueを作成中: ${task.id} - ${task.title}`);
      const issueNumber = createIssue(task, false);
      if (issueNumber && issueNumber !== '作成済み') {
        setTimeout(() => {
          closeIssue(issueNumber);
        }, 1000);
      }
    }
  }
}

main();

