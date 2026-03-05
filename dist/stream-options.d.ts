/** Options for streaming or observing events */
export interface StreamOptions {
    /** Resume streaming from this event ID */
    lowerBound?: string;
    /** Whether to include the lower-bound event itself in the results */
    includeLowerBoundEvent?: boolean;
    /** Stop streaming at this event ID */
    upperBound?: string;
    /** Whether to include the upper-bound event itself in the results */
    includeUpperBoundEvent?: boolean;
    /** Stream only the latest event of the given type per subject */
    latestByEventType?: string;
}
