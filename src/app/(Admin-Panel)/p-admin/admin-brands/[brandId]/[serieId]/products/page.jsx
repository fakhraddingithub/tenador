import SerieProductsClient from "@/components/admin/SerieProductsClient";

export default async function Page({ params }) {
    const { serieId, brandId } = await params;

    return (
        <div className="flex justify-center">
            <SerieProductsClient serieId={serieId} brandId={brandId} />
        </div>
    );
}
