import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import badgeHero from "@/assets/badge-hero.png";
import badgeMachine from "@/assets/badge-machine.png";

interface CorredorProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corredor?: {
    name: string;
    type: string;
    avatar: string;
    experiencia: string;
    ranking: string;
    nivel: string;
    badges: Array<{
      name: string;
      icon: string;
    }>;
  };
}

export const CorredorProfileDialog = ({ open, onOpenChange, corredor }: CorredorProfileDialogProps) => {
  if (!corredor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Close</span>
        </button>

        {/* Profile Content */}
        <div className="flex gap-6">
          {/* Avatar */}
          <div className="rounded-full bg-[#d4af37] overflow-hidden flex-shrink-0" style={{ width: '80px', height: '80px' }}>
            <img src={corredor.avatar} alt={corredor.name} className="w-full h-full object-cover" />
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            {/* Name and Type */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{corredor.name}</h2>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{corredor.type}</p>
            </div>

            {/* Stats - All in one line */}
            <div className="flex items-center gap-1 text-sm flex-wrap">
              <span className="text-muted-foreground">Nível de experiência:</span>
              <span className="text-foreground font-medium">{corredor.experiencia}</span>
            </div>

            <div className="flex items-center gap-1 text-sm flex-wrap">
              <span className="text-muted-foreground">Ranking atual:</span>
              <span className="font-medium" style={{ color: '#d4af37' }}>{corredor.ranking}</span>
            </div>

            <div className="flex items-center gap-1 text-sm flex-wrap">
              <span className="text-muted-foreground">Nível:</span>
              <span className="font-medium" style={{ color: '#CCF725' }}>{corredor.nivel}</span>
            </div>

            {/* Badges */}
            {corredor.badges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Badges conquistadas:</h3>
                <div className="flex items-center gap-6 flex-wrap">
                  {corredor.badges.map((badge, index) => {
                    const isUrl = badge.icon.startsWith("http");
                    const imgSrc = isUrl ? badge.icon : (badge.name === 'Hero' ? badgeHero : badgeMachine);
                    return (
                      <div key={index} className="flex flex-col items-center gap-2">
                        <img src={imgSrc} alt={badge.name} className="w-16 h-16 object-contain" />
                        <span className="text-xs font-medium" style={{ color: '#CCF725' }}>{badge.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
