export function normalizeUnansweredQuestion(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

export function unansweredQuestionKey(input: string): string {
  return normalizeUnansweredQuestion(input).toLowerCase()
}
