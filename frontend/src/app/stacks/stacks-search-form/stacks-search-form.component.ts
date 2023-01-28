import { Component, OnInit, ChangeDetectionStrategy, EventEmitter, Output, ViewChild, HostListener, ElementRef } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AssetsService } from '../../services/assets.service';
import { StateService } from '../../services/state.service';
import { Observable, of, Subject, zip, BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map, startWith,  tap } from 'rxjs/operators';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { ApiService } from '../../services/api.service';
import { StacksSearchResultsComponent } from './search-results/stacks-search-results.component';
import { c32addressDecode } from 'c32check';
import { StacksApiService } from '../stacks-api.service';
import { SearchSuccessResult } from '@stacks/stacks-blockchain-api-types';


@Component({
  selector: 'app-stacks-search-form',
  templateUrl: './stacks-search-form.component.html',
  styleUrls: ['./stacks-search-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StacksSearchFormComponent implements OnInit {
  network = '';
  assets: object = {};
  isSearching = false;
  isTypeaheading$ = new BehaviorSubject<boolean>(false);
  typeAhead$: Observable<any>;
  searchForm: UntypedFormGroup;
  dropdownHidden = false;
  isBlockHash = false;
  validID$:  Observable<any>; 

  @HostListener('document:click', ['$event'])
  onDocumentClick(event) {
    if (this.elementRef.nativeElement.contains(event.target)) {
      this.dropdownHidden = false;
    } else {
      this.dropdownHidden = true;
    }
  }


  /*
    For future iterations, if you want to add ContractId search support, here is a good place to start

    validateContractId(contract_id) {
      if (!contract_id.includes(".")) return false;
      const stxAddress = contract_id.split(".")[0];
      const contractName = contract_id.split(".")[1];
      const nameRegex = /[a-zA-Z]([a-zA-Z0-9]|[-_!?+<>=/*])*$|^[-+=/*]$|^[<>]=?$/;

      try {
        const validStacksAddress = validateStacksAddress(stxAddress);
        const validName = nameRegex.exec(contractName);
        return !!(validName && validStacksAddress);
      } catch (e) {
        return false;
      }
    };
  */

  // Unfortunately, the regex for a STX's Block Hash and a Transaction ID is identical
  regexTransaction = /0x[A-Fa-f0-9]{64}/;
  regexBlockheight = /^[0-9]{1,9}$/;

  focus$ = new Subject<string>();
  click$ = new Subject<string>();

  @Output() searchTriggered = new EventEmitter();
  @ViewChild('searchResults') searchResults: StacksSearchResultsComponent;
  @HostListener('keydown', ['$event']) keydown($event): void {
    this.handleKeyDown($event);
  }

  constructor(
    private formBuilder: UntypedFormBuilder,
    private router: Router,
    private assetsService: AssetsService,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private apiService: ApiService,
    private relativeUrlPipe: RelativeUrlPipe,
    private elementRef: ElementRef,
    private stacksApiService: StacksApiService
  ) { }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.searchForm = this.formBuilder.group({
      searchText: ['', Validators.required],
    });

    const searchText$ = this.searchForm.get('searchText').valueChanges
    .pipe(
      map((text) => {
        return text.trim();
      }),
      distinctUntilChanged(),
    );

    const searchResults$ = searchText$.pipe(
      debounceTime(200),
      switchMap((text) => {
        if (!text.length) {
          return of([
            [],
            { nodes: [], channels: [] }
          ]);
        }
        this.isTypeaheading$.next(true);
        if (!this.stateService.env.LIGHTNING) {
          return zip(
            this.stacksApiService.getAddressesByPrefix$(text).pipe(catchError(() => of([]))),

            [{ nodes: [], channels: [] }],
          );
        }
        return zip(
          this.stacksApiService.getAddressesByPrefix$(text).pipe(catchError(() => of([]))),
          this.apiService.lightningSearch$(text).pipe(catchError(() => of({
            nodes: [],
            channels: [],
          }))),
        );
      }),
      tap((result: any[]) => {
        this.isTypeaheading$.next(false);
      })
    );

    this.typeAhead$ = combineLatest(
      [
        searchText$,
        searchResults$.pipe(
        startWith([
          [],
          {
            nodes: [],
            channels: [],
          }
        ]))
      ]
      ).pipe(
        map((latestData) => {
          const searchText = latestData[0];
          if (!searchText.length) {
            return {
              searchText: '',
              hashQuickMatch: false,
              blockHeight: false,
              txId: false,
              address: false,
              addresses: [],
              nodes: [],
              channels: [],
            };
          }

          const result = latestData[1];
          const addressPrefixSearchResults = result[0];
          const lightningResults = result[1];

          this.stacksApiService.searchStacksApi$(searchText)
            .subscribe({
              next: (data) => {
                if (data.found === true && data.result.entity_type === 'block_hash'){
                  this.isBlockHash = true;
                } else {
                  this.isBlockHash = false;
                }
              },
              error: (e) => {
                console.log(e);
                this.isBlockHash = false;
              },
              complete: () => console.log('done'),
            });
          const matchesBlockHeight = this.regexBlockheight.test(searchText);
          const matchesTxId = this.regexTransaction.test(searchText) && this.isBlockHash === false;
          const matchesAddress = this.validateStacksAddress(searchText);

          return {
            searchText: searchText,
            hashQuickMatch: +(matchesBlockHeight || this.isBlockHash || matchesTxId || matchesAddress),
            blockHeight: matchesBlockHeight,
            txId: matchesTxId,
            blockHash: this.isBlockHash,
            address: matchesAddress,
            addresses: addressPrefixSearchResults,
            nodes: lightningResults.nodes,
            channels: lightningResults.channels,
          };
        })
      );
  }

  handleKeyDown($event): void {
    this.searchResults.handleKeyDown($event);
  }

  itemSelected(): void {
    setTimeout(() => this.search());
  }

  selectedResult(result: any): void {
    if (typeof result === 'string') {
      this.search(result);
    } else if (typeof result === 'number') {
      this.navigate('/block/', result.toString());
    } else if (result.alias) {
      this.navigate('/lightning/node/', result.public_key);
    } else if (result.short_id) {
      this.navigate('/lightning/channel/', result.id);
    }
  }

  search(result?: string): void {
    const searchText = result || this.searchForm.value.searchText.trim();

    if (searchText) {
      this.isSearching = true;
      this.stacksApiService.searchStacksApi$(searchText).subscribe((data) => {
        if (data.found === true && data.result.entity_type === 'block_hash'){
          this.navigate('/block/', data.result.entity_id);
        }
      })
      if (this.validateStacksAddress(searchText)) {
        this.navigate('/address/', searchText);
      } else if (this.regexBlockheight.test(searchText)) {
        this.navigate('/block/', searchText);
      } else if (this.regexTransaction.test(searchText)) {
        const matches = this.regexTransaction.exec(searchText);
        if (this.network === 'liquid' || this.network === 'liquidtestnet') {
          if (this.assets[matches[1]]) {
            this.navigate('/assets/asset/', matches[1]);
          }
          this.electrsApiService.getAsset$(matches[1])
            .subscribe(
              () => { this.navigate('/assets/asset/', matches[1]); },
              () => {
                this.electrsApiService.getBlock$(matches[1])
                  .subscribe(
                    (block) => { this.navigate('/block/', matches[1], { state: { data: { block } } }); },
                    () => { this.navigate('/tx/', matches[0]); });
              }
            );
        } else {
          this.navigate('/tx/', matches[0]);
        }
      } else {
        this.searchResults.searchButtonClick();
        this.isSearching = false;
      }
    }
  }

  navigate(url: string, searchText: string, extras?: any): void {
    this.router.navigate([this.relativeUrlPipe.transform(url), searchText], extras);
    this.searchTriggered.emit();
    this.searchForm.setValue({
      searchText: '',
    });
    this.isSearching = false;
  }
  validateStacksAddress(stacksAddress: string): boolean {
    try {
      c32addressDecode(stacksAddress);
      return true;
    } catch (e) {
      return false;
    }
  }
}
