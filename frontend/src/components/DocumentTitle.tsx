import { FC, useEffect } from "react";

interface DocumentTitleProps {
  title?: string;
}

const DocumentTitle: FC<DocumentTitleProps> = ({ title }) => {
  useEffect(() => {
    document.title =
      (title ? `${title} | ` : "") + "Aggregate Frequency Calculator";
  }, [title]);

  return null;
};

export default DocumentTitle;
