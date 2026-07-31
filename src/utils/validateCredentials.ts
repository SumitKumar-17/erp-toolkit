import type Credential from 'models/Credential'

export enum FieldValidationStatus {
  SomeFieldIsEmpty,
  AllFieldsFilled
}

const PLACEHOLDER_QUESTION = (n: number): string => `Your erp question ${n}`

/**
 * A question field still holding its placeholder text means the user never
 * got past step 1 (fetching their security questions), so it counts as empty.
 */
const validateCredentials = (credential: Credential): FieldValidationStatus => {
  const allFilled =
    credential.username !== '' &&
    credential.password !== '' &&
    credential.a1 !== '' &&
    credential.a2 !== '' &&
    credential.a3 !== '' &&
    credential.q1 !== PLACEHOLDER_QUESTION(1) &&
    credential.q2 !== PLACEHOLDER_QUESTION(2) &&
    credential.q3 !== PLACEHOLDER_QUESTION(3)

  return allFilled ? FieldValidationStatus.AllFieldsFilled : FieldValidationStatus.SomeFieldIsEmpty
}

export default validateCredentials
