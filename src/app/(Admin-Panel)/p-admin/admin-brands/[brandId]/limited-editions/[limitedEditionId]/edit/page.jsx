import LimitedEditionForm from '@/components/admin/LimitedEditionForm';

export default async function EditLimitedEditionPage({ params }) {
  const { brandId, limitedEditionId } = await params;

  return <LimitedEditionForm brandId={brandId} limitedEditionId={limitedEditionId} />;
}
