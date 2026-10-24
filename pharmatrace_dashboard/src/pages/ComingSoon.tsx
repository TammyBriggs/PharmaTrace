import { PageHeading } from '../components/ui';

export default function ComingSoon({ title }: { title: string }) {
  return <PageHeading title={title} subtitle="This module is built in an upcoming milestone." />;
}
