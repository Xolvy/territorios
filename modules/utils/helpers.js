export const formatPhoneNumber = (numero) => {
    if (!numero) return '';
    const cleaned = numero.toString().replace(/\D/g, '');
    return cleaned.length === 7 ? `${cleaned.slice(0, 3)} ${cleaned.slice(3)}` : numero;
};

export const getStatusColor = (status) => {
    const s = status || 'Sin asignar'; // Default fallback
    if (s === 'Contestaron') return 'text-green-400';
    if (s === 'No contestan') return 'text-orange-400';
    if (s === 'No llamar') return 'text-red-400';
    if (s === 'Colgaron') return 'text-gray-400';
    if (s === 'Revisita') return 'text-yellow-400';
    if (s === 'Suspendido') return 'text-orange-500';
    if (s === 'Testigo') return 'text-purple-400';
    if (s === 'Pendiente' || s === 'Sin asignar') return 'text-gray-500';
    return 'text-gray-500';
};
