import LimitedEditionForm from '@/components/admin/LimitedEditionForm';

export default async function AddLimitedEditionPage({ params }) {
  const { brandId } = await params;

  return <LimitedEditionForm brandId={brandId} />;
}
