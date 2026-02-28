#!/usr/bin/env node

/**
 * 既存のIssue本文のリンクを完全なURL形式に更新するスクリプト
 * 
 * 使用方法:
 *   node scripts/update-issue-links.js [--phase=N]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      // デフォルト値を使用
    }
  } catch (error) {
    // デフォルト値を使用
  }
  
  return { repoUrl, defaultBranch };
}

function getIssues(phaseFilter = null) {
  try {
    let cmd = 'gh issue list --state all --json number,title,body,labels --limit 500';
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    let issues = JSON.parse(output);
    
    // Phaseフィルタ
    if (phaseFilter !== null) {
      const phaseLabel = `phase-${phaseFilter}`;
      issues = issues.filter(issue => 
        issue.labels.some(label => label.name === phaseLabel)
      );
    }
    
    return issues;
  } catch (error) {
    console.error('Issue取得エラー:', error.message);
    return [];
  }
}

function updateIssueBody(issue, repoUrl, defaultBranch) {
  let body = issue.body || '';
  const originalBody = body;
  
  // 既存のmainブランチのリンクをmasterに修正
  if (body.includes('/blob/main/')) {
    body = body.replace(/\/blob\/main\//g, `/blob/${defaultBranch}/`);
  }
  
  // 相対パスのリンクを完全なURLに置換
  const patterns = [
    {
      // マスタータスクボード（相対パス）
      old: /\[マスタータスクボード\]\(\.\.\/\.\.\/IMPLEMENTATION_PHASES\/master-task-board\.md\)/g,
      new: `[マスタータスクボード](${repoUrl}/blob/${defaultBranch}/IMPLEMENTATION_PHASES/master-task-board.md)`
    },
    {
      // Phase詳細（相対パス）
      old: /\[Phase \d+詳細\]\(\.\.\/\.\.\/IMPLEMENTATION_PHASES\/(phase-\d+-[^.]+\.md)\)/g,
      new: (match, filename) => {
        const phaseNum = match.match(/Phase (\d+)/)?.[1];
        return `[Phase ${phaseNum}詳細](${repoUrl}/blob/${defaultBranch}/IMPLEMENTATION_PHASES/${filename})`;
      }
    },
    {
      // その他の相対パス
      old: /\[([^\]]+)\]\(\.\.\/\.\.\/IMPLEMENTATION_PHASES\/([^)]+)\)/g,
      new: (match, linkText, filepath) => {
        return `[${linkText}](${repoUrl}/blob/${defaultBranch}/IMPLEMENTATION_PHASES/${filepath})`;
      }
    }
  ];
  
  for (const pattern of patterns) {
    if (typeof pattern.new === 'function') {
      body = body.replace(pattern.old, pattern.new);
    } else {
      body = body.replace(pattern.old, pattern.new);
    }
  }
  
  const updated = body !== originalBody;
  return { body, updated };
}

function updateIssue(issueNumber, newBody) {
  try {
    // 一時ファイルに本文を書き込む
    const tempFile = path.join(__dirname, '..', '.issue-body-temp.md');
    fs.writeFileSync(tempFile, newBody, 'utf-8');
    
    execSync(`gh issue edit ${issueNumber} --body-file "${tempFile}"`, {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    
    // 一時ファイルを削除
    fs.unlinkSync(tempFile);
    
    return true;
  } catch (error) {
    console.error(`  ✗ Issue #${issueNumber} の更新に失敗:`, error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const phaseFilter = args.find(arg => arg.startsWith('--phase='))?.split('=')[1];
  
  const { repoUrl, defaultBranch } = getRepoInfo();
  console.log(`リポジトリURL: ${repoUrl}`);
  console.log(`デフォルトブランチ: ${defaultBranch}`);
  
  const issues = getIssues(phaseFilter);
  console.log(`取得したIssue数: ${issues.length}`);
  
  let updatedCount = 0;
  
  for (const issue of issues) {
    const { body: newBody, updated } = updateIssueBody(issue, repoUrl, defaultBranch);
    
    if (updated) {
      console.log(`\nIssue #${issue.number}: ${issue.title}`);
      if (updateIssue(issue.number, newBody)) {
        console.log(`  ✓ リンクを更新しました`);
        updatedCount++;
      }
    }
  }
  
  if (updatedCount > 0) {
    console.log(`\n完了: ${updatedCount}件のIssueを更新しました`);
  } else {
    console.log('\n更新するIssueはありませんでした');
  }
}

main();

