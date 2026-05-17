import SerieEditPage from "@/components/admin/SerieEditForm";

export default async function Page({ params }) {
    const { serieId, brandId } = await params

    return (
        <div className="flex justify-center">
            <SerieEditPage brandId={brandId} id={serieId} />
        </div>
    );
}