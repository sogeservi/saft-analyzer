import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_TRANSACTION_TYPES = ["N", "R", "A", "J"];
const TOLERANCE = 0.01;

export function validateGeneralLedger(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const gl = saftData.generalLedgerEntries;
  if (!gl) return errors;

  const basePath = "GeneralLedgerEntries";
  const accountIds = new Set(
    saftData.masterFiles.generalLedgerAccounts.map((a) => a.accountID),
  );

  // GL_001: NumberOfEntries matches actual
  let actualCount = 0;
  for (const j of gl.journals) {
    actualCount += j.transactions.length;
  }
  if (gl.numberOfEntries !== actualCount) {
    errors.push({
      code: "GL_001",
      severity: "error",
      message: `NumberOfEntries declarado (${gl.numberOfEntries}) difere do real (${actualCount}).`,
      explanation: "O campo NumberOfEntries deve corresponder ao número real de Transaction.",
      path: `${basePath}.NumberOfEntries`,
      section: "GeneralLedger",
      autoFixable: true,
      originalValue: String(gl.numberOfEntries),
      suggestedFix: `Corrigir para ${actualCount}`,
    });
  }

  // GL_002 & GL_003: TotalDebit/TotalCredit matches sum
  let sumDebit = 0;
  let sumCredit = 0;
  for (const j of gl.journals) {
    for (const tx of j.transactions) {
      for (const dl of tx.lines.debitLines) sumDebit += dl.debitAmount;
      for (const cl of tx.lines.creditLines) sumCredit += cl.creditAmount;
    }
  }

  if (Math.abs(gl.totalDebit - sumDebit) > TOLERANCE) {
    errors.push({
      code: "GL_002",
      severity: "error",
      message: `TotalDebit declarado (${gl.totalDebit.toFixed(2)}) difere da soma calculada (${sumDebit.toFixed(2)}).`,
      explanation: "O TotalDebit deve ser igual à soma de todos os DebitAmount.",
      path: `${basePath}.TotalDebit`,
      section: "GeneralLedger",
      autoFixable: true,
      originalValue: String(gl.totalDebit),
      suggestedFix: `Corrigir para ${sumDebit.toFixed(2)}`,
    });
  }

  if (Math.abs(gl.totalCredit - sumCredit) > TOLERANCE) {
    errors.push({
      code: "GL_003",
      severity: "error",
      message: `TotalCredit declarado (${gl.totalCredit.toFixed(2)}) difere da soma calculada (${sumCredit.toFixed(2)}).`,
      explanation: "O TotalCredit deve ser igual à soma de todos os CreditAmount.",
      path: `${basePath}.TotalCredit`,
      section: "GeneralLedger",
      autoFixable: true,
      originalValue: String(gl.totalCredit),
      suggestedFix: `Corrigir para ${sumCredit.toFixed(2)}`,
    });
  }

  const seenTransactionIds = new Map<string, Set<string>>();

  for (const journal of gl.journals) {
    const journalPath = `${basePath}.Journal[${journal.journalID}]`;
    const txIdSet = new Set<string>();
    seenTransactionIds.set(journal.journalID, txIdSet);

    for (const tx of journal.transactions) {
      const txPath = `${journalPath}.Transaction[${tx.transactionID}]`;

      // GL_004: Transaction balanced
      let txDebit = 0;
      let txCredit = 0;
      for (const dl of tx.lines.debitLines) txDebit += dl.debitAmount;
      for (const cl of tx.lines.creditLines) txCredit += cl.creditAmount;
      if (Math.abs(txDebit - txCredit) > TOLERANCE) {
        errors.push({
          code: "GL_004",
          severity: "error",
          message: `Transação '${tx.transactionID}' não balanceada: Débito=${txDebit.toFixed(2)}, Crédito=${txCredit.toFixed(2)}.`,
          explanation: "Cada transação deve ter débitos iguais a créditos.",
          path: txPath,
          section: "GeneralLedger",
          documentId: tx.transactionID,
          autoFixable: false,
        });
      }

      // GL_005: TransactionDate within period
      if (tx.transactionDate) {
        const h = saftData.header;
        if (h.startDate && tx.transactionDate < h.startDate) {
          errors.push({
            code: "GL_005",
            severity: "error",
            message: `TransactionDate '${tx.transactionDate}' anterior a StartDate '${h.startDate}'.`,
            explanation: "Cada TransactionDate deve estar dentro do período declarado.",
            path: `${txPath}.TransactionDate`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
        if (h.endDate && tx.transactionDate > h.endDate) {
          errors.push({
            code: "GL_005",
            severity: "error",
            message: `TransactionDate '${tx.transactionDate}' posterior a EndDate '${h.endDate}'.`,
            explanation: "Cada TransactionDate deve estar dentro do período declarado.",
            path: `${txPath}.TransactionDate`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }

      // GL_006: SystemEntryDate valid and >= TransactionDate
      if (tx.systemEntryDate && tx.transactionDate) {
        if (tx.systemEntryDate.substring(0, 10) < tx.transactionDate) {
          errors.push({
            code: "GL_006",
            severity: "error",
            message: `SystemEntryDate '${tx.systemEntryDate}' anterior a TransactionDate '${tx.transactionDate}'.`,
            explanation: "O SystemEntryDate deve ser >= TransactionDate.",
            path: `${txPath}.SystemEntryDate`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }

      // GL_007: AccountID references valid account
      for (const dl of tx.lines.debitLines) {
        if (!accountIds.has(dl.accountID)) {
          errors.push({
            code: "GL_007",
            severity: "error",
            message: `AccountID '${dl.accountID}' na transação '${tx.transactionID}' não existe nos GeneralLedgerAccounts.`,
            explanation: "Cada AccountID deve existir nos MasterFiles.",
            path: `${txPath}.Lines.DebitLine.AccountID`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }
      for (const cl of tx.lines.creditLines) {
        if (!accountIds.has(cl.accountID)) {
          errors.push({
            code: "GL_007",
            severity: "error",
            message: `AccountID '${cl.accountID}' na transação '${tx.transactionID}' não existe nos GeneralLedgerAccounts.`,
            explanation: "Cada AccountID deve existir nos MasterFiles.",
            path: `${txPath}.Lines.CreditLine.AccountID`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }

      // GL_009: TransactionID unique within journal
      if (txIdSet.has(tx.transactionID)) {
        errors.push({
          code: "GL_009",
          severity: "error",
          message: `TransactionID '${tx.transactionID}' duplicado no diário '${journal.journalID}'.`,
          explanation: "Cada TransactionID deve ser único dentro do seu diário.",
          path: `${txPath}.TransactionID`,
          section: "GeneralLedger",
          documentId: tx.transactionID,
          autoFixable: false,
        });
      }
      txIdSet.add(tx.transactionID);

      // GL_012: Negative amounts
      for (const dl of tx.lines.debitLines) {
        if (dl.debitAmount < 0) {
          errors.push({
            code: "GL_012",
            severity: "error",
            message: `DebitAmount negativo (${dl.debitAmount}) na transação '${tx.transactionID}'.`,
            explanation: "DebitAmount deve ser >= 0.",
            path: `${txPath}.Lines.DebitLine[${dl.recordID}].DebitAmount`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }
      for (const cl of tx.lines.creditLines) {
        if (cl.creditAmount < 0) {
          errors.push({
            code: "GL_012",
            severity: "error",
            message: `CreditAmount negativo (${cl.creditAmount}) na transação '${tx.transactionID}'.`,
            explanation: "CreditAmount deve ser >= 0.",
            path: `${txPath}.Lines.CreditLine[${cl.recordID}].CreditAmount`,
            section: "GeneralLedger",
            documentId: tx.transactionID,
            autoFixable: false,
          });
        }
      }

      // GL_016: TransactionType valid
      if (tx.transactionType && !VALID_TRANSACTION_TYPES.includes(tx.transactionType)) {
        errors.push({
          code: "GL_016",
          severity: "error",
          message: `TransactionType '${tx.transactionType}' inválido. Valores válidos: ${VALID_TRANSACTION_TYPES.join(", ")}.`,
          explanation: "N (Normal), R (Regularizações), A (Apuramento de resultados), J (Ajustamentos).",
          path: `${txPath}.TransactionType`,
          section: "GeneralLedger",
          documentId: tx.transactionID,
          autoFixable: false,
        });
      }
    }
  }

  // GL_015: Trial balance check
  const accounts = saftData.masterFiles.generalLedgerAccounts;
  let totalClosingDebit = 0;
  let totalClosingCredit = 0;
  for (const acc of accounts) {
    totalClosingDebit += acc.closingDebitBalance;
    totalClosingCredit += acc.closingCreditBalance;
  }
  if (Math.abs(totalClosingDebit - totalClosingCredit) > TOLERANCE) {
    errors.push({
      code: "GL_015",
      severity: "error",
      message: `Balancete não equilibrado: Débito=${totalClosingDebit.toFixed(2)}, Crédito=${totalClosingCredit.toFixed(2)}.`,
      explanation: "A soma dos saldos finais de débito deve ser igual à soma dos saldos finais de crédito.",
      path: `${basePath}`,
      section: "GeneralLedger",
      autoFixable: false,
    });
  }

  // GL_014: Class 6/7 year-end zeroing
  for (const acc of accounts) {
    const classDigit = acc.accountID.charAt(0);
    if (classDigit === "6" || classDigit === "7") {
      if (acc.closingDebitBalance !== 0 || acc.closingCreditBalance !== 0) {
        errors.push({
          code: "GL_014",
          severity: "error",
          message: `Conta ${acc.accountID} (classe ${classDigit}) com saldo final não nulo: D=${acc.closingDebitBalance.toFixed(2)}, C=${acc.closingCreditBalance.toFixed(2)}.`,
          explanation: "Contas de classe 6 (gastos) e 7 (rendimentos) devem ter saldo final zero no encerramento do exercício.",
          path: `MasterFiles.GeneralLedgerAccounts.Account[${acc.accountID}]`,
          section: "GeneralLedger",
          documentId: acc.accountID,
          autoFixable: false,
        });
      }
    }
  }

  return errors;
}
