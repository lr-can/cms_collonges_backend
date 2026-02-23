/**
 * Composant Vue - Détail kit / inventaire
 * Chargé en mode script (vue.global.js)
 * IDs disponibles chargés depuis l'API - pas de saisie manuelle
 */
(function () {
  'use strict';

  const { createApp } = Vue;

  createApp({
    data() {
      return {
        idKit: '',
        kit: null,
        loading: true,
        error: null,
        modalRemplacement: null,
        modalAjout: false,
        modify: true,
        materielsDisponibles: [],
        typeAffectationSelectionne: null,
        stockDisponibleAffectation: [],
        stockDisponibleRemplacement: [],
        remplacementForm: {
          ancienIdStock: '',
          nouveauIdStock: '',
          datePeremptionNouveau: '',
          dateArticle: '',
          numeroLot: ''
        },
        itemsEdites: []
      };
    },
    computed: {},
    methods: {
      formatDate(d) {
        if (!d) return '';
        const x = new Date(d);
        return isNaN(x.getTime()) ? '' : x.toLocaleDateString('fr-FR');
      },
      getApiBase() {
        return window.location.origin;
      },
      async loadKit() {
        this.loading = true;
        this.error = null;
        const params = new URLSearchParams(window.location.search);
        this.idKit = params.get('idKit') || params.get('id') || '';
        this.modify = params.get('modify') !== 'false';
        if (!this.idKit) {
          this.error = "Paramètre idKit manquant dans l'URL.";
          this.loading = false;
          return;
        }
        try {
          const r = await fetch(
            this.getApiBase() +
              '/kits/completKit/' +
              encodeURIComponent(this.idKit) +
              '?contenuComplet=1'
          );
          if (!r.ok) throw new Error('Kit non trouvé');
          this.kit = await r.json();
        } catch (e) {
          this.error = e.message || 'Erreur de chargement';
        } finally {
          this.loading = false;
        }
        this.itemsEdites = this.kit?.items || [];
      },
      keyItem(item) {
        return item.materielKitId + (item.id || '');
      },
      async ouvrirModalAjout() {
        this.modalAjout = true;
        this.typeAffectationSelectionne = null;
        this.stockDisponibleAffectation = [];
        try {
          const r = await fetch(
            this.getApiBase() +
              '/kits/materielKit/' +
              encodeURIComponent(this.kit.nomKit)
          );
          if (r.ok) this.materielsDisponibles = await r.json();
          else this.materielsDisponibles = [];
        } catch (e) {
          this.materielsDisponibles = [];
        }
      },
      async selectionnerTypeAffectation(m) {
        this.typeAffectationSelectionne = m;
        this.stockDisponibleAffectation = [];
        try {
          const r = await fetch(
            this.getApiBase() +
              '/kits/stockDisponible?materielKitId=' +
              encodeURIComponent(m.id)
          );
          if (r.ok) this.stockDisponibleAffectation = await r.json();
        } catch (e) {
          this.stockDisponibleAffectation = [];
        }
      },
      retourTypesAffectation() {
        this.typeAffectationSelectionne = null;
        this.stockDisponibleAffectation = [];
      },
      async affecterStockExistant(s) {
        if (!s?.idStock || !this.kit?.id) return;
        try {
          const r = await fetch(this.getApiBase() + '/kits/affecterStock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              completKitId: this.kit.id,
              idStocks: [s.idStock]
            })
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.message || 'Erreur');
          }
          this.modalAjout = false;
          this.typeAffectationSelectionne = null;
          this.stockDisponibleAffectation = [];
          await this.loadKit();
        } catch (e) {
          alert('Erreur : ' + e.message);
        }
      },
      async affecterMateriel(item) {
        this.modalAjout = true;
        this.materielsDisponibles = [{
          id: item.materielKitId,
          nomCommun: item.nomCommun,
          nomCommande: item.nomCommande,
          quantite: item.quantiteTheorique ?? 1
        }];
        this.typeAffectationSelectionne = null;
        await this.selectionnerTypeAffectation({
          id: item.materielKitId,
          nomCommun: item.nomCommun,
          nomCommande: item.nomCommande,
          quantite: item.quantiteTheorique ?? 1
        });
      },
      ouvrirImprimer() {
        const url =
          this.getApiBase() +
          '/kits/ficheInventaire/' +
          encodeURIComponent(this.kit.idKit || this.idKit);
        window.open(url, '_blank', 'width=850,height=700,scrollbars=yes');
      },
      async demarrerRemplacement(item) {
        this.modalRemplacement = item;
        this.stockDisponibleRemplacement = [];
        this.remplacementForm = {
          ancienIdStock: item.id || '',
          nouveauIdStock: '',
          datePeremptionNouveau: '',
          dateArticle: item.dateArticle
            ? new Date(item.dateArticle).toISOString().slice(0, 10)
            : '',
          numeroLot: item.numeroLot || ''
        };
        if (item.idMateriel) {
          try {
            const r = await fetch(
              this.getApiBase() +
                '/kits/stockDisponible?idMateriel=' +
                encodeURIComponent(item.idMateriel)
            );
            if (r.ok) {
              this.stockDisponibleRemplacement = await r.json();
            }
          } catch (_) {}
        }
      },
      async executerRemplacement() {
        const item = this.modalRemplacement;
        const completKitId = this.kit.id;
        if (!completKitId || !item.id) return;

        const body = {
          completKitId,
          stockKitId: item.id,
          dateArticle: this.remplacementForm.dateArticle || null,
          numeroLot: this.remplacementForm.numeroLot || '',
          datePeremption: this.remplacementForm.datePeremptionNouveau || null,
          ancienIdStock:
            this.remplacementForm.ancienIdStock || item.id || undefined,
          nouveauIdStock: this.remplacementForm.nouveauIdStock || undefined,
          datePeremptionNouveau: this.remplacementForm.datePeremptionNouveau
            ? this.formatDate(this.remplacementForm.datePeremptionNouveau)
            : undefined,
          nomMateriel: item.nomCommun || item.nomCommande
        };

        try {
          const r = await fetch(this.getApiBase() + '/kits/remplacerMateriel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.message || 'Erreur');
          }
          this.modalRemplacement = null;
          await this.loadKit();
        } catch (e) {
          alert('Erreur : ' + e.message);
        }
      }
    },
    mounted() {
      this.loadKit();
    }
  }).mount('#app');
})();
