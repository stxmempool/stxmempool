import { Component, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { switchMap, tap, throttleTime, catchError, map, shareReplay, startWith, pairwise, filter } from 'rxjs/operators';
import { Observable, of, Subscription, asyncScheduler, EMPTY, combineLatest } from 'rxjs';
import { StateService } from '../../services/state.service';
import { SeoService } from '../../services/seo.service';
import { WebsocketService } from '../../services/websocket.service';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { BlockAudit, BlockExtended, TransactionStripped } from '../../interfaces/node-api.interface';
import { StacksBlockExtended, StacksTransactionStripped, StacksTransactionExtended, MinedStacksTransactionExtended} from '../stacks.interfaces';
import { Transaction } from '@stacks/stacks-blockchain-api-types';
import { StacksBlockOverviewGraphComponent } from '../stacks-block-overview-graph/stacks-block-overview-graph.component';

import { detectWebGL } from '../../shared/graphs.utils';
import { StacksApiService } from '../stacks-api.service';

@Component({
  selector: 'app-stacks-block',
  templateUrl: './stacks-block.component.html',
  styleUrls: ['./stacks-block.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class StacksBlockComponent implements OnInit, OnDestroy {
  network = '';
  // block: BlockExtended;
  block: any;

  // blockAudit: BlockAudit = undefined;
  blockHeight: number;
  lastBlockHeight: number;
  nextBlockHeight: number;
  blockHash: string;
  isLoadingBlock = true;
  // latestBlock: BlockExtended;
  // latestBlocks: BlockExtended[] = [];
  latestBlock: any;
  latestBlocks: any[] = [];
  transactions: MinedStacksTransactionExtended[];
  
  isLoadingTransactions = true;
  strippedTransactions: StacksTransactionStripped[];

  overviewTransitionDirection: string;
  isLoadingOverview = true;
  error: any;
  blockSubsidy: number;
  fees: number;
  paginationMaxSize: number;
  page = 1;
  itemsPerPage: number;
  txsLoadingStatus$: Observable<number>;
  showDetails = false;
  showPreviousBlocklink = true;
  showNextBlocklink = true;
  transactionsError: any = null;
  overviewError: any = null;
  webGlEnabled = true;
  indexingAvailable = false;
  auditEnabled = true;
  auditDataMissing: boolean;
  isMobile = window.innerWidth <= 767.98;
  hoverTx: string;
  numMissing: number = 0;
  numUnexpected: number = 0;
  mode: 'projected' | 'actual' = 'projected';

  transactionSubscription: Subscription;
  overviewSubscription: Subscription;
  auditSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  blocksSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;
  nextBlockSubscription: Subscription = undefined;
  nextBlockSummarySubscription: Subscription = undefined;
  nextBlockTxListSubscription: Subscription = undefined;
  timeLtrSubscription: Subscription;
  timeLtr: boolean;
  childChangeSubscription: Subscription;

  @ViewChildren('blockGraphProjected') blockGraphProjected: QueryList<StacksBlockOverviewGraphComponent>;
  @ViewChildren('blockGraphActual') blockGraphActual: QueryList<StacksBlockOverviewGraphComponent>;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    public stateService: StateService,
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private relativeUrlPipe: RelativeUrlPipe,
    private stacksApiService: StacksApiService
  ) {
    this.webGlEnabled = detectWebGL();
  }

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    this.network = this.stateService.network;
    this.itemsPerPage = this.stateService.env.ITEMS_PER_PAGE;

    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });

    this.indexingAvailable = (this.stateService.env.BASE_MODULE === 'mempool' && this.stateService.env.MINING_DASHBOARD === true);
    this.auditEnabled = this.indexingAvailable;

    this.txsLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['blocktxs-' + this.blockHash] !== undefined ? indicators['blocktxs-' + this.blockHash] : 0)
      );
    

    this.blocksSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        this.latestBlock = block;
        this.latestBlocks.unshift(block);
        this.latestBlocks = this.latestBlocks.slice(0, this.stateService.env.KEEP_BLOCKS_AMOUNT);
        this.setNextAndPreviousBlockLink();

        if (block.id === this.blockHash) {
          this.block = block;
          if (block?.extras?.reward != undefined) {
            this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
          }
        }
      });

    const block$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        this.block = undefined;
        this.page = 1;
        this.error = undefined;
        this.fees = undefined;
        this.stateService.markBlock$.next({});
        this.auditDataMissing = false;

        if (history.state.data && history.state.data.blockHeight) {
          this.blockHeight = history.state.data.blockHeight;
          this.updateAuditDataMissingFromBlockHeight(this.blockHeight);
        }

        let isBlockHeight = false;
        if (/^[0-9]+$/.test(blockHash)) {
          isBlockHeight = true;
        } else {
          this.blockHash = blockHash;
        }
        document.body.scrollTo(0, 0);

        if (history.state.data && history.state.data.block) {
          this.blockHeight = history.state.data.block.height;
          this.updateAuditDataMissingFromBlockHeight(this.blockHeight);
          return of(history.state.data.block);
        } else {
          this.isLoadingBlock = true;
          this.isLoadingOverview = true;
          let blockInCache: BlockExtended;

          if (isBlockHeight) {
            blockInCache = this.latestBlocks.find((block) => block.height === parseInt(blockHash, 10));
            if (blockInCache) {
              return of(blockInCache);
            }
            return this.stacksApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))

              .pipe(
                switchMap((hash) => {
                  this.blockHash = hash;
                  this.location.replaceState(
                    this.router.createUrlTree([(this.network ? '/' + this.network : '') + '/block/', hash]).toString()
                  );
                  return this.stacksApiService.getBlock$(hash).pipe(
                    catchError((err) => {
                      this.error = err;
                      this.isLoadingBlock = false;
                      this.isLoadingOverview = false;
                      return EMPTY;
                    })
                  );
                }),
                catchError((err) => {
                  this.error = err;
                  this.isLoadingBlock = false;
                  this.isLoadingOverview = false;
                  return EMPTY;
                }),
              );
          }

          blockInCache = this.latestBlocks.find((block) => block.id === this.blockHash);
          if (blockInCache) {
            return of(blockInCache);
          }
            return this.stacksApiService.getBlock$(blockHash).pipe(

            catchError((err) => {
              this.error = err;
              this.isLoadingBlock = false;
              this.isLoadingOverview = false;
              return EMPTY;
            })
          );
        }
      }),
      tap((block: StacksBlockExtended) => {
      
        if (block.height > 0) {
          // Preload previous block summary (execute the http query so the response will be cached)
          this.unsubscribeNextBlockSubscriptions();
          setTimeout(() => {
            this.nextBlockSubscription = this.stacksApiService.getBlock$(block.previousblockhash).subscribe();

            this.nextBlockTxListSubscription = this.stacksApiService.getBlockTransactions$(block.previousblockhash).subscribe();

          }, 100);
        }
        this.updateAuditDataMissingFromBlockHeight(block.height);
        this.block = block;
        this.blockHeight = block.height;
        this.lastBlockHeight = this.blockHeight;
        this.nextBlockHeight = block.height + 1;
        this.setNextAndPreviousBlockLink();

        this.seoService.setTitle($localize`:@@block.component.browser-title:Block ${block.height}:BLOCK_HEIGHT:: ${block.id}:BLOCK_ID:`);
        this.isLoadingBlock = false;
        this.setBlockSubsidy();
        if (block?.extras?.reward !== undefined) {
          this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
        }
        this.stateService.markBlock$.next({ blockHeight: this.blockHeight });
        this.isLoadingTransactions = true;
        this.transactions = null;
        this.transactionsError = null;
        this.isLoadingOverview = true;
        this.overviewError = null;
      }),
      throttleTime(300, asyncScheduler, { leading: true, trailing: true }),
      shareReplay(1)
    );
    this.transactionSubscription = block$.pipe(
      switchMap((block) => this.stacksApiService.getBlockTransactions$(block.id)

        .pipe(
          catchError((err) => {
            this.transactionsError = err;
            return of([]);
        }))
      ),
    )
    // .subscribe((transactions: Transaction[]) => {
    .subscribe((transactions: any[]) => {
      this.transactions = transactions;
      this.isLoadingTransactions = false;
    },
    (error) => {
      this.error = error;
      this.isLoadingBlock = false;
      this.isLoadingOverview = false;
    });

    if (!this.indexingAvailable) {
      this.overviewSubscription = block$.pipe(
        startWith(null),
        pairwise(),
        switchMap(([prevBlock, block]) => this.stacksApiService.getStrippedBlockTransactions$(block.id)

          .pipe(
            catchError((err) => {
              this.overviewError = err;
              return of([]);
            }),
            switchMap((transactions) => {
              if (prevBlock) {
                return of({ transactions, direction: (prevBlock.height < block.height) ? 'right' : 'left' });
              } else {
                return of({ transactions, direction: 'down' });
              }
            })
          )
        ),
      )
      .subscribe(({transactions, direction}: {transactions: StacksTransactionStripped[], direction: string}) => {

        this.strippedTransactions = transactions;
        this.isLoadingOverview = false;
        this.setupBlockGraphs();
      },
      (error) => {
        this.error = error;
        this.isLoadingOverview = false;
      });
    }


    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params.showDetails === 'true') {
        this.showDetails = true;
      } else {
        this.showDetails = false;
      }
      if (params.view === 'projected') {
        this.mode = 'projected';
      } else {
        this.mode = 'actual';
      }
      this.setupBlockGraphs();
    });

    this.keyNavigationSubscription = this.stateService.keyNavigation$.subscribe((event) => {
      const prevKey = this.timeLtr ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.timeLtr ? 'ArrowRight' : 'ArrowLeft';
      if (this.showPreviousBlocklink && event.key === prevKey && this.nextBlockHeight - 2 >= 0) {
        this.navigateToPreviousBlock();
      }
      if (event.key === nextKey) {
        if (this.showNextBlocklink) {
          this.navigateToNextBlock();
        } else {
          this.router.navigate([this.relativeUrlPipe.transform('/mempool-block'), '0']);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.childChangeSubscription = combineLatest([this.blockGraphProjected.changes.pipe(startWith(null)), this.blockGraphActual.changes.pipe(startWith(null))]).subscribe(() => {
      this.setupBlockGraphs();
    });
  }

  ngOnDestroy() {
    this.stateService.markBlock$.next({});
    this.transactionSubscription.unsubscribe();
    this.overviewSubscription?.unsubscribe();
    this.auditSubscription?.unsubscribe();
    this.keyNavigationSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
    this.networkChangedSubscription.unsubscribe();
    this.queryParamsSubscription.unsubscribe();
    this.timeLtrSubscription.unsubscribe();
    this.unsubscribeNextBlockSubscriptions();
    this.childChangeSubscription.unsubscribe();
  }

  unsubscribeNextBlockSubscriptions() {
    if (this.nextBlockSubscription !== undefined) {
      this.nextBlockSubscription.unsubscribe();
    }
    if (this.nextBlockSummarySubscription !== undefined) {
      this.nextBlockSummarySubscription.unsubscribe();
    }
    if (this.nextBlockTxListSubscription !== undefined) {
      this.nextBlockTxListSubscription.unsubscribe();
    }
  }

  // TODO - Refactor this.fees/this.reward for liquid because it is not
  // used anymore on Bitcoin networks (we use block.extras directly)
  setBlockSubsidy() {
    this.blockSubsidy = 0;
  }

  pageChange(page: number, target: HTMLElement) {
    const start = (page - 1) * this.itemsPerPage;
    this.isLoadingTransactions = true;
    this.transactions = null;
    this.transactionsError = null;
    target.scrollIntoView(); // works for chrome

    this.stacksApiService.getBlockTransactions$(this.block.id, start)
    
      .pipe(
        catchError((err) => {
          this.transactionsError = err;
          return of([]);
      })
      )
     .subscribe((transactions) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
        target.scrollIntoView(); // works for firefox
      });
  }

  toggleShowDetails() {
    if (this.showDetails) {
      this.showDetails = false;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: false, view: this.mode },
        queryParamsHandling: 'merge',
        fragment: 'block'
      });
    } else {
      this.showDetails = true;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: true, view: this.mode },
        queryParamsHandling: 'merge',
        fragment: 'details'
      });
    }
  }

  hasTaproot(version: number): boolean {
    const versionBit = 2; // Taproot
    return (Number(version) & (1 << versionBit)) === (1 << versionBit);
  }

  displayTaprootStatus(): boolean {
    if (this.stateService.network !== '') {
      return false;
    }
    return this.block && this.block.height > 681393 && (new Date().getTime() / 1000) < 1628640000;
  }

  navigateToPreviousBlock() {
    if (!this.block) {
      return;
    }
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight - 2);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.block.previousblockhash], { state: { data: { block, blockHeight: this.nextBlockHeight - 2 } } });
  }

  navigateToNextBlock() {
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.nextBlockHeight], { state: { data: { block, blockHeight: this.nextBlockHeight } } });
  }

  setNextAndPreviousBlockLink(){
    if (this.latestBlock) {
      if (!this.blockHeight){
        this.showPreviousBlocklink = false;
      } else {
        this.showPreviousBlocklink = true;
      }
      if (this.latestBlock.height && this.latestBlock.height === this.blockHeight) {
        this.showNextBlocklink = false;
      } else {
        this.showNextBlocklink = true;
      }
    }
  }

  setupBlockGraphs(): void {
    if (this.strippedTransactions) {

      this.blockGraphProjected.forEach(graph => {
        graph.destroy();
        if (this.isMobile && this.mode === 'actual') {
          graph.setup(this.strippedTransactions ||  []);

        } else {
          graph.setup([]);

        }
      });
      this.blockGraphActual.forEach(graph => {
        graph.destroy();
        graph.setup(this.strippedTransactions || []);
      });
    }
  }

  onResize(event: any): void {
    const isMobile = event.target.innerWidth <= 767.98;
    const changed = isMobile !== this.isMobile;
    this.isMobile = isMobile;
    this.paginationMaxSize = event.target.innerWidth < 670 ? 3 : 5;

    if (changed) {
      this.changeMode(this.mode);
    }
  }

  changeMode(mode: 'projected' | 'actual'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { showDetails: this.showDetails, view: mode },
      queryParamsHandling: 'merge',
      fragment: 'overview'
    });
  }

  onTxClick(event: StacksTransactionStripped): void {

    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.txid}`);
    this.router.navigate([url]);
  }

  onTxHover(txid: string): void {
    if (txid && txid.length) {
      this.hoverTx = txid;
    } else {
      this.hoverTx = null;
    }
  }

  updateAuditDataMissingFromBlockHeight(blockHeight: number): void {
    switch (this.stateService.network) {
      case 'testnet':
        if (blockHeight < this.stateService.env.TESTNET_BLOCK_AUDIT_START_HEIGHT) {
          this.auditDataMissing = true;
        }
        break;
      case 'signet':
        if (blockHeight < this.stateService.env.SIGNET_BLOCK_AUDIT_START_HEIGHT) {
          this.auditDataMissing = true;
        }
        break;
      default:
        if (blockHeight < this.stateService.env.MAINNET_BLOCK_AUDIT_START_HEIGHT) {
          this.auditDataMissing = true;
        }
    }
  }
}