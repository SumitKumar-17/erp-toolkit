const BASE_URL = 'https://erp.iitkgp.ac.in'

const postForm = async (path: string, body: string): Promise<Response> => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!response.ok) {
    throw new Error(`ERP request failed with status ${response.status}`)
  }

  return response
}

/**
 * Talks to the ERP SSO endpoints needed while a user is setting up their
 * credentials in the popup: resolving a roll number's three security questions.
 */
export default class ERP {
  onGetSecurityQues: (question: string) => void = () => {}

  private readonly username: string
  private readonly securityQuestions = new Set<string>()

  constructor(username: string) {
    this.username = username
  }

  private async getSecurityQues(): Promise<string> {
    const response = await postForm('/SSOAdministration/getSecurityQues.htm', `user_id=${this.username}`)
    return response.text()
  }

  /**
   * The ERP endpoint returns one *new* security question per call until all
   * three (already-asked ones repeat) have been surfaced, so this recurses
   * until no new question is returned or an invalid roll number is detected.
   */
  async getAllSecurityQues(): Promise<string[] | false> {
    while (this.securityQuestions.size < 3) {
      const question = await this.getSecurityQues()

      if (question === 'FALSE') {
        return false
      }

      if (!this.securityQuestions.has(question)) {
        this.securityQuestions.add(question)
        this.onGetSecurityQues(question)
      } else {
        break
      }
    }

    return Array.from(this.securityQuestions)
  }
}
