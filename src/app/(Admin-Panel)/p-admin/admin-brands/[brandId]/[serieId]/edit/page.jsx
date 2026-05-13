import SerieEditPage from "@/components/admin/SerieEditForm";

export default async function Page({ params }) {
    const { serieId } = await params

    return (
        <div className="flex justify-center">
            <SerieEditPage id={serieId} />
        </div>
    );
}