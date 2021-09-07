import createSetter, { Failure, Success } from "./createSetter";
import * as chai from "chai";
import { describe, it } from "mocha";

function assertSuccess<ObjectType, ValueType>(
  result: Failure | Success<ObjectType, ValueType>
): Success<ObjectType, ValueType> {
  chai.assert.isTrue(
    result.isSuccessful,
    `Expected result success but got failure because ${
      (result as Failure).reason
    }`
  );

  return result as Success<ObjectType, ValueType>;
}

describe("createSetter", () => {
  it("Allows single-step paths in maps", () => {
    const input = { a: 1 };

    const result = assertSuccess(createSetter<typeof input, number>("?a"));

    const setter = result.lens(input);

    const resultObject = setter(2);

    chai.assert.equal(resultObject.a, 2, "Did set the result correctly");
  });

  it("Allows single-step paths in arrays", () => {
    const input = [1];

    const result = assertSuccess(createSetter<typeof input, number>("?1"));

    const setter = result.lens(input);

    const resultObject = setter(2);

    chai.assert.equal(resultObject[0], 2, "Did set the result correctly");
  });

  it("works with maps", () => {
    const input = {
      a: 1,
      b: 2,
      c: {
        x: 3,
        y: 4,
      },
    };

    const result = assertSuccess(createSetter<typeof input, number>("?c?y"));

    const setter = result.lens(input);

    const resultObject = setter(5);

    chai.assert.equal(resultObject.c.y, 5, "Did set the result correctly");
  });

  it("works with arrays", () => {
    const input = [1, 2, 3, [4, 5, 6]] as [
      number,
      number,
      number,
      [number, number, number]
    ];

    const result = assertSuccess(createSetter<typeof input, number>("?4?3"));

    const setter = result.lens(input);

    const resultObject = setter(7);

    chai.assert.equal(resultObject[3][2], 7, "Did set the result correctly");
  });

  it("works with mixed maps and arrays", () => {
    const input = { a: 1, b: [1, 2, 3, { c: 4, d: 5, e: [6] }] };

    const result = assertSuccess(
      createSetter<typeof input, number>("?b?4?e?1")
    );

    const setter = result.lens(input);

    const resultObject = setter(7);

    chai.assert.equal(
      (resultObject as any).b[3].e,
      7,
      "Did set the result correctly"
    );
  });

  it("Does not change unchanged stuff", () => {
    const input = { a: {}, b: 2 };

    const result = assertSuccess(createSetter<typeof input, number>("?b"));

    const setter = result.lens(input);

    const resultObject = setter(3);

    chai.assert.equal(resultObject.b, 3, "Did set the result correctly");
    chai.assert.strictEqual(
      resultObject.a,
      input.a,
      "Did not change unchanged things"
    );
  });
});
