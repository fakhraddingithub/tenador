import SerieAdminPage from "@/components/admin/SerieAdminPage";

export default async function Page({ params }) {
    const { serieId,brandId } = await params

    return (
        <div className="flex justify-center">
            <SerieAdminPage serieId={serieId} brandId={brandId}/>
        </div>
    );
}