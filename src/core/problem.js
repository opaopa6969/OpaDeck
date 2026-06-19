export function createProblem(code, severity, message, options = {}) {
  if (!code || typeof code !== 'string') {
    throw new TypeError('Problem code must be a non-empty string.');
  }
  if (!severity || typeof severity !== 'string') {
    throw new TypeError('Problem severity must be a non-empty string.');
  }
  if (!message || typeof message !== 'string') {
    throw new TypeError('Problem message must be a non-empty string.');
  }
  return {
    code,
    severity,
    message,
    target: options.target,
    detail: options.detail,
  };
}

export function problemComparator(a, b) {
  if (a.severity !== b.severity) {
    return severityRank(b.severity) - severityRank(a.severity);
  }
  return String(a.code).localeCompare(String(b.code));
}

function severityRank(severity) {
  switch (severity) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    case 'info':
      return 1;
    default:
      return 0;
  }
}
