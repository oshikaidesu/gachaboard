#!/usr/bin/env node

/**
 * master-task-board.md のタスクをGitHub Issueに変換するスクリプト
 * 
 * 使用方法:
 *   node scripts/create-issues.js [--phase=N] [--dry-run]
 * 
 * 例:
 *   node scripts/create-issues.js --phase=0        # Phase 0のみ作成
 *   node scripts/create-issues.js --dry-run       # 作成せずに内容を表示
 *   node scripts/create-issues.js                 # すべて作成
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_BOARD_PATH = path.join(__dirname, '..', 'IMPLEMENTATION_PHASES', 'master-task-board.md');
const PHASE_DETAILS_DIR = path.join(__dirname, '..', 'IMPLEMENTATION_PHASES');

// Phase詳細ファイルのマッピング
const phaseFiles = {
  '0': 'phase-00-gap-survey.md',
  '1': 'phase-01-auth.md',
  '2': 'phase-02-data-model.md',
  '3': 'phase-03-app-router.md',
  '4': 'phase-04-authorization.md',
  '5': 'phase-05-local-ops.md',
  '6': 'phase-06-asset-delete-gui.md',
  '7': 'phase-07-media-features.md',
  '8': 'phase-08-timeline-comments.md',
  '9': 'phase-09-object-reactions.md',
  '10': 'phase-10-connector-experience.md',
};

function parseTaskBoard() {
  const content = fs.readFileSync(TASK_BOARD_PATH, 'utf-8');
  const tasks = [];
  let currentPhase = null;
  let currentDoneCondition = null;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Phase検出（行末の\rを考慮）
    const phaseMatch = line.match(/^## Phase (\d+): (.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1];
      currentDoneCondition = null;
      continue;
    }

    // 横断タスク検出
    if (line.includes('## 横断タスク')) {
      currentPhase = 'X';
      currentDoneCondition = null;
      continue;
    }

    // done条件検出
    if (line.includes('done条件:')) {
      const doneLines = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('-')) {
        doneLines.push(lines[j].trim().substring(2));
        j++;
      }
      currentDoneCondition = doneLines.join('\n');
      i = j - 1;
      continue;
    }
    
    // 空行はスキップ
    if (line === '') {
      continue;
    }

    // タスク検出（チェックボックス形式: `- [ ]` または `- [x]`）
    const uncheckedMatch = line.match(/^- \[ \] (.+)$/);
    const checkedMatch = line.match(/^- \[x\] (.+)$/);
    const taskMatch = uncheckedMatch || checkedMatch;
    
    if (taskMatch && currentPhase !== null) {
      const fullText = taskMatch[1].trim();
      // Issueリンクを除去（`[#12](url)` の形式）
      const textWithoutLink = fullText.replace(/\s+\[#\d+\]\(.+\)$/, '');
      // タスクIDのパターン: P0-01, P1-01, X-01 など
      const taskIdMatch = textWithoutLink.match(/^([PX]\d+-\d+)\s+(.+)$/);
      
      if (taskIdMatch) {
        tasks.push({
          id: taskIdMatch[1],
          title: taskIdMatch[2],
          phase: currentPhase,
          doneCondition: currentDoneCondition,
          isCompleted: !!checkedMatch,
        });
      } else {
        // IDがない場合（横断タスクなど）
        tasks.push({
          id: null,
          title: textWithoutLink,
          phase: currentPhase,
          doneCondition: currentDoneCondition,
          isCompleted: !!checkedMatch,
        });
      }
    }
  }

  return tasks;
}

export { parseTaskBoard, createIssue };

function getPhaseDetails(phase) {
  if (phase === 'X') return null;
  const fileName = phaseFiles[phase];
  if (!fileName) return null;
  
  const filePath = path.join(PHASE_DETAILS_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  
  return fs.readFileSync(filePath, 'utf-8');
}

function getRepoInfo() {
  let repoUrl = 'https://github.com/oshikaidesu/gachaboard';
  let defaultBranch = 'master';
  
  try {
    const remoteUrl = execSync('git remote get-url origin', { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    }).trim();
    const match = remoteUrl.match(/(?:github\.com[/:]|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      repoUrl = `https://github.com/${match[1]}`;
    }
    
    // デフォルトブランチを取得
    try {
      const branch = execSync('gh repo view --json defaultBranchRef --jq .defaultBranchRef.name', {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      }).trim();
      if (branch) {
        defaultBranch = branch;
      }
    } catch (error) {
      // GitHub CLIが使えない場合はgitコマンドで確認
      try {
        const branch = execSync('git remote show origin | Select-String "HEAD branch"', {
          encoding: 'utf-8',
          cwd: path.join(__dirname, '..'),
          shell: 'powershell.exe'
        }).trim();
        const branchMatch = branch.match(/HEAD branch:\s*(.+)/);
        if (branchMatch) {
          defaultBranch = branchMatch[1].trim();
        }
      } catch (e) {
        // デフォルト値を使用
      }
    }
  } catch (error) {
    // デフォルト値を使用
  }
  
  return { repoUrl, defaultBranch };
}

function createIssueBody(task, phaseDetails) {
  const { repoUrl, defaultBranch } = getRepoInfo();

  let body = `## タスク\n\n${task.title}\n\n`;
  
  if (phaseDetails) {
    // Phase詳細から目的や依存関係を抽出
    const purposeMatch = phaseDetails.match(/## 目的\s*\n\n([\s\S]*?)(\n\n##|$)/);
    if (purposeMatch) {
      body += `## 目的\n\n${purposeMatch[1].trim()}\n\n`;
    }
  }

  // done条件を追加（Phase全体の完了条件）
  if (task.doneCondition) {
    body += `## Phase完了条件\n\n${task.doneCondition}\n\n`;
  }

  body += `## 関連資料\n\n- [マスタータスクボード](${repoUrl}/blob/${defaultBranch}/IMPLEMENTATION_PHASES/master-task-board.md)\n`;
  
  if (phaseDetails && task.phase !== 'X') {
    const phaseNum = `Phase ${task.phase}`;
    const phaseFile = phaseFiles[task.phase] || 'README.md';
    body += `- [${phaseNum}詳細](${repoUrl}/blob/${defaultBranch}/IMPLEMENTATION_PHASES/${phaseFile})\n`;
  }

  return body;
}

function createIssue(task, dryRun = false) {
  const phaseLabel = task.phase === 'X' ? 'cross-cutting' : `phase-${task.phase}`;
  const title = task.id ? `[${task.id}] ${task.title}` : task.title;
  
  const phaseDetails = getPhaseDetails(task.phase);
  const body = createIssueBody(task, phaseDetails);

  if (dryRun) {
    console.log(`\n=== ${title} ===`);
    console.log(`ラベル: ${phaseLabel}`);
    console.log(`本文:\n${body}`);
    return null;
  }

  try {
    // 一時ファイルに本文を書き込んで使用（エスケープ問題を回避）
    const tempFile = path.join(__dirname, '..', '.issue-body-temp.md');
    fs.writeFileSync(tempFile, body, 'utf-8');
    
    const cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body-file "${tempFile}" --label "${phaseLabel}"`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: path.join(__dirname, '..') });
    
    // 一時ファイルを削除
    fs.unlinkSync(tempFile);
    
    // 出力からIssue番号を抽出（例: "https://github.com/owner/repo/issues/123" または "#123"）
    const issueNumber = output.match(/#(\d+)/)?.[1] || output.match(/issues\/(\d+)/)?.[1] || '作成済み';
    console.log(`✓ Created: ${title} -> #${issueNumber}`);
    console.log(`  出力: ${output.trim()}`);
    return issueNumber;
  } catch (error) {
    console.error(`✗ Failed to create: ${title}`);
    console.error(error.message);
    // エラー時も一時ファイルを削除
    const tempFile = path.join(__dirname, '..', '.issue-body-temp.md');
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const phaseFilter = args.find(arg => arg.startsWith('--phase='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  console.log('タスクボードを解析中...');
  const tasks = parseTaskBoard();
  
  // デバッグ: 最初の数行を確認
  if (tasks.length === 0) {
    console.log('警告: タスクが検出されませんでした。ファイルを確認します...');
    const content = fs.readFileSync(TASK_BOARD_PATH, 'utf-8');
    const lines = content.split('\n');
    console.log('最初の50行:');
    lines.slice(0, 50).forEach((line, i) => {
      if (line.includes('P0-01') || line.includes('- [ ]')) {
        console.log(`${i}: ${line}`);
      }
    });
    return;
  }
  
  let filteredTasks = tasks;
  if (phaseFilter) {
    filteredTasks = tasks.filter(t => t.phase === phaseFilter);
    console.log(`Phase ${phaseFilter} のタスクのみ処理: ${filteredTasks.length}件`);
  } else {
    console.log(`全タスク: ${tasks.length}件`);
  }

  if (dryRun) {
    console.log('\n=== DRY RUN モード ===');
    filteredTasks.forEach(task => createIssue(task, true));
  } else {
    console.log('\nIssueを作成中...');
    filteredTasks.forEach((task, index) => {
      console.log(`[${index + 1}/${filteredTasks.length}] ${task.id || task.title}`);
      createIssue(task, false);
      // レート制限を避けるため少し待機
      if (index < filteredTasks.length - 1) {
        setTimeout(() => {}, 500);
      }
    });
    console.log('\n完了！');
  }
}

// スクリプトとして直接実行された場合のみmain()を実行
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1] && process.argv[1].endsWith('create-issues.js');
if (isMainModule) {
  main();
}

