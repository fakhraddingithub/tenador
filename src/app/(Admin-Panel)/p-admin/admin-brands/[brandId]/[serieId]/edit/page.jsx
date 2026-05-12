import SerieCreateFlow from "@/components/admin/SerieEditForm";

export default async function Page({ params }) {
    const { serieId } = await params

    return (
        <div className="flex justify-center">
            <SerieCreateFlow id={serieId} />
        </div>
    );
}