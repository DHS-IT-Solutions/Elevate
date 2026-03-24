// components/shared/Avatar.tsx
import Image from 'next/image'

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm:  { box: 'w-8 h-8',   text: 'text-xs'  },
  md:  { box: 'w-10 h-10', text: 'text-sm'  },
  lg:  { box: 'w-14 h-14', text: 'text-base'},
  xl:  { box: 'w-20 h-20', text: 'text-xl'  },
}

const colorPalette = [
  'bg-red-100 text-red-700',
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-yellow-100 text-yellow-700',
  'bg-lime-100 text-lime-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-sky-100 text-sky-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-purple-100 text-purple-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-pink-100 text-pink-700',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colorPalette[Math.abs(hash) % colorPalette.length]
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const { box, text } = sizeMap[size]
  const color = getColor(name)

  if (imageUrl) {
    return (
      <div className={`${box} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <Image src={imageUrl} alt={name} width={80} height={80}
               className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className={`${box} rounded-full flex items-center justify-center 
                     font-semibold flex-shrink-0 ${color} ${text} ${className}`}>
      {getInitials(name)}
    </div>
  )
}