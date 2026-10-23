import { isValidEmail } from "../email";

describe("isValidEmail", () => {
  it("accepts a normal email, ignoring surrounding spaces", () => {
    expect(isValidEmail(" juani@rollo.test ")).toBe(true);
  });

  it("rejects incomplete ones", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("juani")).toBe(false);
    expect(isValidEmail("juani@")).toBe(false);
    expect(isValidEmail("juani@rollo")).toBe(false);
  });
});
