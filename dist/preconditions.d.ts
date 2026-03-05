/** Ensures that no events exist yet for the given subject */
export interface IsSubjectNewPrecondition {
    type: 'isSubjectNew';
    payload: {
        subject: string;
    };
}
/** Ensures that at least one event exists for the given subject */
export interface IsSubjectExistingPrecondition {
    type: 'isSubjectExisting';
    payload: {
        subject: string;
    };
}
/** Evaluates a GDBQL query and ensures the result is truthy */
export interface IsQueryResultTruePrecondition {
    type: 'isQueryResultTrue';
    payload: {
        query: string;
    };
}
/** All known, strongly-typed precondition variants */
export type TypedPrecondition = IsSubjectNewPrecondition | IsSubjectExistingPrecondition | IsQueryResultTruePrecondition;
/**
 * Escape-hatch for any precondition type that is not yet covered by
 * the SDK types (forward-compatible with future server releases).
 */
export interface GenericPrecondition {
    type: string;
    payload: any;
}
/**
 * A precondition that must hold true before a commit is accepted.
 *
 * You can use one of the strongly-typed variants or fall back to
 * {@link GenericPrecondition} for forward compatibility.
 */
export type Precondition = TypedPrecondition | GenericPrecondition;
