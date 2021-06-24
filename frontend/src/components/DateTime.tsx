interface DateTimeProps {
  datetime: string;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});

const DateTime = (props: DateTimeProps) => {
  const { datetime } = props;

  return (
    <time dateTime={datetime}>{formatter.format(new Date(datetime))}</time>
  );
};

export default DateTime;
