const compactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

const formatCompactDateTime = (datetime: string) => {
  return compactDateTimeFormatter.format(new Date(datetime));
};

export default formatCompactDateTime;
