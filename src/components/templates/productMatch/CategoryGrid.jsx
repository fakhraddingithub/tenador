import ToolCategoryCard from '@/components/common/ToolCategoryCard';
import { matchCategoryPath } from '@/lib/matchTools';

export default function CategoryGrid({ categories }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
      {categories.map((cat) => (
        <ToolCategoryCard key={cat._id} category={cat} href={matchCategoryPath(cat)} />
      ))}
    </div>
  );
}
