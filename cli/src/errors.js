/** An error the CLI prints as is, without a stack trace. */
export class CliError extends Error {}

export class NotSignedInError extends CliError {
  constructor(message = 'Not signed in to Rekogni. Run: rekogni auth login') {
    super(message);
  }
}
