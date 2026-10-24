# Pilot signup requirement

Requirement ID: DEMO-SIGNUP-001

This is a synthetic test fixture requirement, not evidence about real customers.

Given a new fixture dataset and a syntactically valid email address:

1. Open the signup page.
2. Enter a name and an email address.
3. Submit the signup form.

The response must show the visible heading `Your pilot is ready`.

The broken build deliberately returns an error instead. The fixed build meets this requirement.
Each execution starts a new server and empty in-memory dataset. Fixture administration is outside browser capabilities.
