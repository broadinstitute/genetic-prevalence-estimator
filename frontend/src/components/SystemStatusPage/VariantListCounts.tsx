import {
  Box,
  Button,
  Heading,
  Stat,
  StatGroup,
  StatHelpText,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react";

export interface VariantListCountsData {
  right_now: {
    active: number;
    stuck: number;
    oldest_stuck_updated_at: string | null;
    last_ready_at: string | null;
  };
  recent: {
    created: number;
    ready: number;
    error: number;
  };
  all_time: {
    total: number;
    ready: number;
    error: number;
    abandoned: number;
  };
}

export interface VariantListCountThresholds {
  stuck_after_minutes: number;
  abandoned_after_days: number;
  recent_days: number;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const formatTimeSince = (datetime: string | null) => {
  if (datetime === null) {
    return "—";
  }
  const elapsedMs = Date.now() - new Date(datetime).getTime();
  if (elapsedMs < HOUR_MS) {
    return `${Math.floor(elapsedMs / MINUTE_MS)} min`;
  }
  if (elapsedMs < 2 * DAY_MS) {
    return `${Math.floor(elapsedMs / HOUR_MS)} h`;
  }
  return `${Math.floor(elapsedMs / DAY_MS)} days`;
};

const formatErrorRate = (ready: number, error: number) => {
  const finished = ready + error;
  if (finished === 0) {
    return "—";
  }
  return `${Math.round((error / finished) * 100)}%`;
};

const VariantListCounts = ({
  counts,
  thresholds,
  onViewStuckLists,
}: {
  counts: VariantListCountsData;
  thresholds: VariantListCountThresholds;
  onViewStuckLists: () => void;
}) => {
  const { right_now: rightNow, recent, all_time: allTime } = counts;
  const stuckLabel = rightNow.stuck > 0 ? "⚠ Stuck" : "Stuck";

  return (
    <>
      <Heading as="h2" size="md" mb={2}>
        Right now
      </Heading>
      <StatGroup>
        <Stat>
          <StatLabel>Active</StatLabel>
          <StatNumber>{rightNow.active.toLocaleString()}</StatNumber>
          <StatHelpText>
            Queued or processing, updated in the last{" "}
            {thresholds.stuck_after_minutes} min
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>{stuckLabel}</StatLabel>
          <StatNumber>{rightNow.stuck.toLocaleString()}</StatNumber>
          <StatHelpText>
            Not updated for {thresholds.stuck_after_minutes} min to{" "}
            {thresholds.abandoned_after_days} days.{" "}
            <Button variant="link" size="sm" onClick={onViewStuckLists}>
              View
            </Button>
          </StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Oldest stuck</StatLabel>
          <StatNumber>
            {formatTimeSince(rightNow.oldest_stuck_updated_at)}
          </StatNumber>
          <StatHelpText>Time since its last update</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Last list ready</StatLabel>
          <StatNumber>{formatTimeSince(rightNow.last_ready_at)}</StatNumber>
          <StatHelpText>Time since a list last finished</StatHelpText>
        </Stat>
      </StatGroup>

      <Heading as="h3" size="sm" mt={8} mb={2}>
        Last {thresholds.recent_days} days
      </Heading>
      <StatGroup>
        <Stat>
          <StatLabel>Created</StatLabel>
          <StatNumber>{recent.created.toLocaleString()}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel>Ready</StatLabel>
          <StatNumber>{recent.ready.toLocaleString()}</StatNumber>
          <StatHelpText>By last update</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Errors</StatLabel>
          <StatNumber>{recent.error.toLocaleString()}</StatNumber>
          <StatHelpText>By last update</StatHelpText>
        </Stat>
        <Stat>
          <StatLabel>Error rate</StatLabel>
          <StatNumber>{formatErrorRate(recent.ready, recent.error)}</StatNumber>
          <StatHelpText>Of ready and errored</StatHelpText>
        </Stat>
      </StatGroup>

      <Box color="gray.600">
        <Heading as="h3" size="xs" mt={8} mb={2}>
          All time
        </Heading>
        <StatGroup>
          <Stat>
            <StatLabel>Total</StatLabel>
            <StatNumber fontSize="xl">
              {allTime.total.toLocaleString()}
            </StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Ready</StatLabel>
            <StatNumber fontSize="xl">
              {allTime.ready.toLocaleString()}
            </StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Errors</StatLabel>
            <StatNumber fontSize="xl">
              {allTime.error.toLocaleString()}
            </StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Abandoned</StatLabel>
            <StatNumber fontSize="xl">
              {allTime.abandoned.toLocaleString()}
            </StatNumber>
            <StatHelpText>
              Queued or processing, not updated in{" "}
              {thresholds.abandoned_after_days} days
            </StatHelpText>
          </Stat>
        </StatGroup>
      </Box>
    </>
  );
};

export default VariantListCounts;
