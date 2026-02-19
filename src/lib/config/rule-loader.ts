import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import type { ValidationRule, RuleFile, RuleIndex } from "../types/rules";
import type { Severity } from "../types/errors";

const RULES_DIR =
  process.env.RULES_DIR ?? path.join(process.cwd(), "rules");

let cachedIndex: RuleIndex | null = null;
let watcher: fs.FSWatcher | null = null;

function loadRuleFiles(): ValidationRule[] {
  const allRules: ValidationRule[] = [];

  if (!fs.existsSync(RULES_DIR)) {
    return allRules;
  }

  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".yaml"));

  for (const file of files) {
    const filePath = path.join(RULES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(content) as RuleFile | null;
    if (parsed?.rules) {
      allRules.push(...parsed.rules);
    }
  }

  return allRules;
}

function buildIndex(rules: ValidationRule[]): RuleIndex {
  const byId = new Map<string, ValidationRule>();
  const bySection = new Map<string, ValidationRule[]>();
  const bySeverity = new Map<Severity, ValidationRule[]>();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    byId.set(rule.id, rule);

    const sectionList = bySection.get(rule.section) ?? [];
    sectionList.push(rule);
    bySection.set(rule.section, sectionList);

    const severityList = bySeverity.get(rule.severity) ?? [];
    severityList.push(rule);
    bySeverity.set(rule.severity, severityList);
  }

  return { byId, bySection, bySeverity };
}

export function getRuleIndex(): RuleIndex {
  if (!cachedIndex) {
    cachedIndex = buildIndex(loadRuleFiles());
  }
  return cachedIndex;
}

export function getRule(id: string): ValidationRule | undefined {
  return getRuleIndex().byId.get(id);
}

export function getRulesForSection(section: string): ValidationRule[] {
  return getRuleIndex().bySection.get(section) ?? [];
}

export function reloadRules(): void {
  cachedIndex = buildIndex(loadRuleFiles());
}

export function startHotReload(): void {
  if (watcher) return;
  if (!fs.existsSync(RULES_DIR)) return;

  watcher = fs.watch(RULES_DIR, { persistent: false }, (eventType, filename) => {
    if (filename?.endsWith(".yaml")) {
      cachedIndex = null;
    }
  });
}

export function stopHotReload(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
