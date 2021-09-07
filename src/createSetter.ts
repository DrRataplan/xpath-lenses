import {
  evaluateXPathToBoolean,
  evaluateXPathToStrings,
  evaluateXPathToFirstNode,
  INodesFactory,
  parseScript,
} from "fontoxpath";
import { document, Element } from "slimdom";

export type LensSetter<ObjectType, ValueType> = (
  value: ValueType
) => ObjectType;

type LensGetter<ValueType> = () => ValueType | null;

type Lens<ObjectType, ValueType> = (whole: ObjectType) => {
  setter: LensSetter<ObjectType, ValueType>;
  getter: LensGetter<ValueType>;
};

export type Failure = { isSuccessful: false; reason: string };
export type Success<ObjectType, ValueType> = {
  isSuccessful: true;
  lens: (whole: ObjectType) => LensSetter<ObjectType, ValueType>;
};

function success<ObjectType, ValueType>(
  setter: (whole: ObjectType) => LensSetter<ObjectType, ValueType>
): Success<ObjectType, ValueType> {
  return { isSuccessful: true, lens: setter };
}

function failure(reason: string): { isSuccessful: false; reason: string } {
  return { isSuccessful: false, reason };
}

type Partial = { [key: string]: Partial } | Partial[];

function namespaceResolver(prefix: string) {
  return prefix ? undefined : "http://www.w3.org/2005/XQueryX";
}

function getLookupSteps(parsedModule: Element): Failure | string[] {
  const pathExpr = evaluateXPathToFirstNode(
    "mainModule/queryBody/pathExpr",
    parsedModule,
    null,
    null,
    {
      namespaceResolver,
    }
  ) as any;

  if (pathExpr) {
    // Assert we have but one step
    if (evaluateXPathToBoolean("count(stepExpr) > 1", pathExpr)) {
      return failure("Too unknown steps");
    }
    return evaluateXPathToStrings(
      "stepExpr/(filterExpr/unaryLookup | lookup)/(integerConstantExpr/value | NCName)",
      pathExpr,
      null,
      null,
      { namespaceResolver }
    );
  } else {
    const lookups = evaluateXPathToStrings(
      "mainModule/queryBody/unaryLookup",
      parsedModule,
      null,
      null,
      {
        namespaceResolver,
      }
    );
    if (lookups.length === 0) {
      return failure("No unary lookup found");
    }
    return lookups;
  }
}

/**
 * Create a lens setter
 */
export default function createSetter<
  ObjectType extends unknown[] | { [key: string]: unknown },
  ValueType
>(xpath: string): Failure | Success<ObjectType, ValueType> {
  const parsedModule = parseScript(xpath, {}, document) as Element;

  // For the steps, fold the lookups
  const lookupSteps = getLookupSteps(parsedModule);
  if ("isSuccessful" in lookupSteps) {
    return lookupSteps;
  }
  let lenses: Lens<unknown, unknown>[] = [];
  for (const name of lookupSteps) {
    lenses.push((partial: Partial) => {
      if (Array.isArray(partial)) {
        if (!/\d+/.test(name)) {
          throw new Error(
            `Cannot use the string ${name} to index the array ${JSON.stringify(
              partial
            )}`
          );
        }
        const index = parseInt(name) - 1;
        return {
          getter: () => partial[index],
          setter: (value: Partial) => {
            // Place the value in the array, without mutating it
            const newArray = partial.concat();
            newArray[index] = value;
            return newArray;
          },
        };
      }

      return {
        getter: () => partial[name],
        setter: (value: unknown) => {
          // Place the value in the array, without mutating it
          const newMap: { [key: string]: unknown } = {};
          for (const key of Object.keys(partial)) {
            if (key === name) {
              newMap[key] = value;
              continue;
            }
            newMap[key] = partial[key];
          }

          return newMap;
        },
      };
    });
  }

  return success((whole: ObjectType) => {
    let setters: LensSetter<unknown, unknown>[] = [];
    let partial = whole as Partial;
    for (let i = 0; i < lenses.length; ++i) {
      const lens = lenses[i];

      const { getter, setter } = lens(partial);

      const partialResult = getter();
      if (
        i < lenses.length - 1 &&
        (typeof partialResult !== "object" || partialResult === null)
      ) {
        throw new Error(
          `No result for the step ${i + 1}. We tried to get ${
            lookupSteps[i]
          } from ${JSON.stringify(partial)} and we got ${JSON.stringify(
            partialResult
          )}`
        );
      }
      partial = partialResult as Partial;
      setters.push(setter);
    }

    return (value: ValueType) => {
      // Now go over the setters in reverse order to set the deepest object and slowly move upwards
      let newPartial = value as unknown;
      for (let i = setters.length - 1; i >= 0; --i) {
        const setter = setters[i];
        newPartial = setter(newPartial);
      }

      return newPartial as ObjectType;
    };
  });
}
