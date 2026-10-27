import { BIO_MAX, NAME_MAX, USERNAME_MAX, WORST_CASE_FIXTURES, WORST_CASE_STATES } from "../worst-case-fixtures";
import { usernameError } from "../username";

describe("worst-case fixtures", () => {
  it("has at least one profile per state", () => {
    for (const state of WORST_CASE_STATES) expect(WORST_CASE_FIXTURES[state].length).toBeGreaterThan(0);
  });

  it("stays inside what the backend accepts", () => {
    for (const { props } of Object.values(WORST_CASE_FIXTURES).flat()) {
      expect(props.name.length).toBeLessThanOrEqual(NAME_MAX);
      if (props.username) expect(usernameError(props.username)).toBeNull();
      if (props.username) expect(props.username.length).toBeLessThanOrEqual(USERNAME_MAX);
      if (props.bio) {
        expect(props.bio.length).toBeLessThanOrEqual(BIO_MAX);
        expect(props.bio.split(/\r\n|\r|\n/).length).toBeLessThanOrEqual(3);
      }
    }
  });
});
