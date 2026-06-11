import CollaborationForm from '@/components/admin/CollaborationForm';

export default async function EditCollaborationPage({ params }) {
  const { collaborationId } = await params;

  return <CollaborationForm collaborationId={collaborationId} />;
}
