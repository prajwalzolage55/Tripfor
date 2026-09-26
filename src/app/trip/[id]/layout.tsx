import TripLayoutClient from './TripLayoutClient';

export function generateStaticParams() {
  return [{ id: 'view' }];
}

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return <TripLayoutClient>{children}</TripLayoutClient>;
}
