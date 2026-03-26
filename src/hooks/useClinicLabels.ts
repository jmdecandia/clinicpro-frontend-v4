import { useAuth } from '@/contexts/AuthContext';

interface ClinicLabels {
  // Client/Patient labels
  client: string;
  clientPlural: string;
  clientLower: string;
  clientPluralLower: string;
  
  // Professional labels
  professional: string;
  professionalPlural: string;
  professionalLower: string;
  professionalPluralLower: string;
}

const defaultLabels: ClinicLabels = {
  client: 'Paciente',
  clientPlural: 'Pacientes',
  clientLower: 'paciente',
  clientPluralLower: 'pacientes',
  professional: 'Profesional',
  professionalPlural: 'Profesionales',
  professionalLower: 'profesional',
  professionalPluralLower: 'profesionales',
};

export function useClinicLabels(): ClinicLabels {
  const { clinic } = useAuth();
  
  if (!clinic) {
    return defaultLabels;
  }
  
  const clientLabel = clinic.clientTypeLabel || defaultLabels.client;
  const professionalLabel = clinic.professionalTypeLabel || defaultLabels.professional;
  
  return {
    client: clientLabel,
    clientPlural: `${clientLabel}s`,
    clientLower: clientLabel.toLowerCase(),
    clientPluralLower: `${clientLabel.toLowerCase()}s`,
    professional: professionalLabel,
    professionalPlural: `${professionalLabel}es`,
    professionalLower: professionalLabel.toLowerCase(),
    professionalPluralLower: `${professionalLabel.toLowerCase()}es`,
  };
}
